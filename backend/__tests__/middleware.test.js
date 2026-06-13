const { requireLocalhost } = require('../middleware');

function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
}

describe('requireLocalhost middleware', () => {
    let next;

    beforeEach(() => {
        next = jest.fn();
    });

    // ── Allowed IPs ──────────────────────────────────────────────────────────

    it('calls next() for IPv4 localhost', () => {
        const req = { ip: '127.0.0.1', connection: { remoteAddress: '127.0.0.1' } };
        const res = makeRes();
        requireLocalhost(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() for IPv6 localhost ::1', () => {
        const req = { ip: '::1', connection: { remoteAddress: '::1' } };
        const res = makeRes();
        requireLocalhost(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('calls next() for IPv4-mapped IPv6 localhost ::ffff:127.0.0.1', () => {
        const req = { ip: '::ffff:127.0.0.1', connection: { remoteAddress: '::ffff:127.0.0.1' } };
        const res = makeRes();
        requireLocalhost(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });

    // ── Blocked IPs ──────────────────────────────────────────────────────────

    it('returns 403 for LAN IP address', () => {
        const req = { ip: '192.168.1.100', connection: { remoteAddress: '192.168.1.100' } };
        const res = makeRes();
        requireLocalhost(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.stringContaining('Acceso denegado') })
        );
    });

    it('returns 403 for internet IP address', () => {
        const req = { ip: '8.8.8.8', connection: { remoteAddress: '8.8.8.8' } };
        const res = makeRes();
        requireLocalhost(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 403 for another loopback variant (127.0.0.2)', () => {
        const req = { ip: '127.0.0.2', connection: { remoteAddress: '127.0.0.2' } };
        const res = makeRes();
        requireLocalhost(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    // ── Edge cases ───────────────────────────────────────────────────────────

    it('falls back to connection.remoteAddress when req.ip is empty', () => {
        const req = { ip: '', connection: { remoteAddress: '127.0.0.1' } };
        const res = makeRes();
        requireLocalhost(req, res, next);
        // ip is '' → isLocal is false (we rely on req.ip || remoteAddress)
        // '' is falsy so it falls back to '127.0.0.1' → should pass
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('returns 403 when ip is undefined and connection has LAN address', () => {
        const req = { ip: undefined, connection: { remoteAddress: '10.0.0.5' } };
        const res = makeRes();
        requireLocalhost(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 403 when both ip and connection are missing', () => {
        const req = {};
        const res = makeRes();
        requireLocalhost(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('does not call next() after sending 403 (no double-response)', () => {
        const req = { ip: '192.168.0.1', connection: { remoteAddress: '192.168.0.1' } };
        const res = makeRes();
        requireLocalhost(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledTimes(1);
    });
});
