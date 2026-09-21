const assert = require('assert');
const createPlugin = require('../index');
const {
  getSources,
  parseExcludedSources,
  isSourceExcluded,
  isVesselExcluded,
} = require('../lib/helpers');

const now = () => new Date().toISOString();

function positionNode(sources) {
  const node = {
    value: { latitude: 60.01, longitude: 24.01 },
    timestamp: now(),
  };
  if (sources.length > 0) {
    node.$source = sources[0];
    if (sources.length > 1) {
      node.values = {};
      for (const source of sources) {
        node.values[source] = { value: node.value, timestamp: now() };
      }
    }
  }
  return node;
}

function vesselWithSources(sources) {
  return {
    mmsi: '200000111',
    name: 'TARGET',
    navigation: { position: positionNode(sources) },
    sensors: { ais: { class: { value: 'A', timestamp: now() } } },
  };
}

// Drive the real plugin and count emitted sentences.
function emitCount(vessels, options) {
  const emitted = [];
  const app = {
    selfId: 'urn:mrn:signalk:uuid:self-1',
    getSelfPath: () => ({ latitude: 60.0, longitude: 24.0 }),
    getPath: () => vessels,
    emit: (eventName, data) => emitted.push(data),
    debug: () => {},
    setPluginStatus: () => {},
    reportOutputMessages: () => {},
  };
  const plugin = createPlugin(app);
  plugin.start(options);
  plugin.stop();
  return emitted.length;
}

describe('source exclude filter (issue #43)', function () {
  describe('parseExcludedSources', function () {
    it('splits, trims and lower-cases', function () {
      assert.deepStrictEqual(
        parseExcludedSources(' maiana.AI , Other.II '),
        ['maiana.ai', 'other.ii'],
      );
    });

    it('drops empty entries', function () {
      assert.deepStrictEqual(parseExcludedSources('a,,  ,b'), ['a', 'b']);
    });

    it('returns an empty list for non-strings and blanks', function () {
      assert.deepStrictEqual(parseExcludedSources(''), []);
      assert.deepStrictEqual(parseExcludedSources(undefined), []);
      assert.deepStrictEqual(parseExcludedSources(null), []);
      assert.deepStrictEqual(parseExcludedSources(42), []);
    });
  });

  describe('isSourceExcluded', function () {
    const excluded = parseExcludedSources('maiana.AI,n2k-on-ve.can-socket');

    it('matches the full source exactly, ignoring case', function () {
      assert.strictEqual(isSourceExcluded('maiana.AI', excluded), true);
      assert.strictEqual(isSourceExcluded('MAIANA.ai', excluded), true);
    });

    it('matches on a dot boundary so a label covers its talkers', function () {
      assert.strictEqual(isSourceExcluded('n2k-on-ve.can-socket.115', excluded), true);
      assert.strictEqual(isSourceExcluded('maiana', parseExcludedSources('maiana')), true);
      assert.strictEqual(isSourceExcluded('maiana.AI', parseExcludedSources('maiana')), true);
    });

    it('does not match a different label sharing a prefix', function () {
      assert.strictEqual(isSourceExcluded('maianaX.AI', excluded), false);
      assert.strictEqual(isSourceExcluded('maianaX.AI', parseExcludedSources('maiana')), false);
    });

    it('keeps unrelated sources', function () {
      assert.strictEqual(isSourceExcluded('aiscast.II', excluded), false);
    });

    it('keeps everything when nothing is excluded', function () {
      assert.strictEqual(isSourceExcluded('maiana.AI', []), false);
    });

    it('handles a missing source', function () {
      assert.strictEqual(isSourceExcluded(undefined, excluded), false);
      assert.strictEqual(isSourceExcluded(null, excluded), false);
    });
  });

  describe('getSources', function () {
    it('reads $source', function () {
      assert.deepStrictEqual(
        getSources(vesselWithSources(['maiana.AI']), 'navigation.position'),
        ['maiana.AI'],
      );
    });

    it('reads every contributor under values, most recent first', function () {
      assert.deepStrictEqual(
        getSources(vesselWithSources(['aiscast.II', 'maiana.AI']), 'navigation.position'),
        ['aiscast.II', 'maiana.AI'],
      );
    });

    it('returns an empty list when the path or vessel is absent', function () {
      assert.deepStrictEqual(getSources({}, 'navigation.position'), []);
      assert.deepStrictEqual(getSources(null, 'navigation.position'), []);
      assert.deepStrictEqual(getSources({ navigation: null }, 'navigation.position'), []);
    });
  });

  describe('isVesselExcluded', function () {
    const excluded = parseExcludedSources('maiana.AI');

    it('excludes when the current source matches', function () {
      assert.strictEqual(isVesselExcluded(vesselWithSources(['maiana.AI']), excluded), true);
    });

    it('excludes when ANY contributing source matches, not just the latest', function () {
      // aiscast wrote last, but maiana can see the target and is already
      // emitting it, so a second copy would duplicate it.
      const vessel = vesselWithSources(['aiscast.II', 'maiana.AI']);
      assert.strictEqual(vessel.navigation.position.$source, 'aiscast.II');
      assert.strictEqual(isVesselExcluded(vessel, excluded), true);
    });

    it('keeps a vessel seen only by a non-excluded source', function () {
      assert.strictEqual(isVesselExcluded(vesselWithSources(['aiscast.II']), excluded), false);
    });

    it('keeps a vessel with no source information', function () {
      assert.strictEqual(isVesselExcluded(vesselWithSources([]), excluded), false);
    });

    it('keeps everything when the exclude list is empty', function () {
      assert.strictEqual(isVesselExcluded(vesselWithSources(['maiana.AI']), []), false);
    });
  });

  describe('end to end through the plugin', function () {
    const target = 'urn:mrn:imo:mmsi:200000111';

    it('emits the target when no filter is configured', function () {
      const vessels = { [target]: vesselWithSources(['maiana.AI']) };
      assert.strictEqual(emitCount(vessels, {}), 2);
    });

    it('suppresses the target when its source is excluded', function () {
      const vessels = { [target]: vesselWithSources(['maiana.AI']) };
      assert.strictEqual(emitCount(vessels, { excludeSources: 'maiana.AI' }), 0);
    });

    it('suppresses a multi-source target even when another source wrote last', function () {
      const vessels = { [target]: vesselWithSources(['aiscast.II', 'maiana.AI']) };
      assert.strictEqual(emitCount(vessels, { excludeSources: 'maiana.AI' }), 0);
    });

    it('still emits targets from other sources', function () {
      const vessels = { [target]: vesselWithSources(['aiscast.II']) };
      assert.strictEqual(emitCount(vessels, { excludeSources: 'maiana.AI' }), 2);
    });

    it('filters only the excluded vessel in a mixed picture', function () {
      const vessels = {
        'urn:mrn:imo:mmsi:200000111': vesselWithSources(['maiana.AI']),
        'urn:mrn:imo:mmsi:200000222': vesselWithSources(['aiscast.II']),
      };
      assert.strictEqual(emitCount(vessels, {}), 4);
      assert.strictEqual(emitCount(vessels, { excludeSources: 'maiana.AI' }), 2);
    });
  });
});
