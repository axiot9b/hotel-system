const { AuditLog } = require('../models');

/**
 * Registra una acción en el log de auditoría.
 * Falla silenciosamente para no interrumpir la operación principal.
 */
module.exports = function logAudit(userId, action, entity, entityId, details, ip) {
  AuditLog.create({ userId, action, entity, entityId, details, ipAddress: ip })
    .catch(() => {});
};
