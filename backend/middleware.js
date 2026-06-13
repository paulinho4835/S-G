function requireLocalhost(req, res, next) {
    const ip = req.ip || (req.connection && req.connection.remoteAddress) || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocal) {
        return res.status(403).json({ error: 'Acceso denegado: esta operación solo se permite desde el equipo local.' });
    }
    next();
}

module.exports = { requireLocalhost };
