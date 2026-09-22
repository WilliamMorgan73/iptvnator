import { channelInitials } from './tv-channel-initials.util';

describe('channelInitials', () => {
    it('returns empty string for blank input', () => {
        expect(channelInitials('   ')).toBe('');
    });

    it('takes the first two letters of a single word', () => {
        expect(channelInitials('Eurosport')).toBe('EU');
    });

    it('takes the first letter of the first two words', () => {
        expect(channelInitials('Nova Sports 1')).toBe('NS');
    });

    it('uppercases the result', () => {
        expect(channelInitials('discovery channel')).toBe('DC');
    });
});
