import '@meisterplayer/meister-mock';
import Smooth from '../src/js/Smooth';

jest.mock('../src/js/lib/hasplayer');

const PLUGIN_NAME = 'Smooth';
const SUPPORTED_TYPES = ['smooth', 'mss'];

describe('Smooth class', () => {
    test(`pluginName should be ${PLUGIN_NAME}`, () => {
        expect(Smooth.pluginName).toBe(PLUGIN_NAME);
    });

    test('pluginVersion should return a version string', () => {
        // Version should match the SemVer pattern (e.g. 2.11.9)
        expect(Smooth.pluginVersion).toMatch(/\d+\.\d+\.\d+/);
    });
});
