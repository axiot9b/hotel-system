const nodemailer = require('nodemailer');

// Si no hay SMTP configurado, el módulo trabaja en modo silencioso
function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

const hotelName    = () => process.env.HOTEL_NAME    || 'Hotel System';
const hotelAddress = () => process.env.HOTEL_ADDRESS || '';
const hotelPhone   = () => process.env.HOTEL_PHONE   || '';
const fromAddr     = () => process.env.SMTP_FROM     || `"${hotelName()}" <noreply@hotel.com>`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function baseHtml(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; background:#f4f4f4; margin:0; padding:0; }
    .wrap { max-width:600px; margin:32px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .header { background:#1e3a5f; color:#fff; padding:28px 32px; }
    .header h1 { margin:0; font-size:20px; }
    .header p { margin:4px 0 0; font-size:13px; opacity:.7; }
    .body { padding:28px 32px; color:#333; }
    table { width:100%; border-collapse:collapse; margin:16px 0; font-size:14px; }
    th { text-align:left; color:#666; font-weight:600; padding:6px 0; border-bottom:2px solid #eee; }
    td { padding:8px 0; border-bottom:1px solid #f0f0f0; }
    .total-row td { font-weight:bold; border-top:2px solid #eee; border-bottom:none; padding-top:12px; }
    .badge { display:inline-block; background:#e8f5e9; color:#2e7d32; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600; }
    .badge.pending { background:#fff8e1; color:#f57f17; }
    .footer { background:#f8f8f8; padding:16px 32px; font-size:12px; color:#999; text-align:center; border-top:1px solid #eee; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>${hotelName()}</h1>
      <p>${hotelAddress()} ${hotelPhone() ? '· ' + hotelPhone() : ''}</p>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      Este es un correo automático, por favor no responda a este mensaje.<br/>
      © ${new Date().getFullYear()} ${hotelName()}
    </div>
  </div>
</body>
</html>`;
}

// ── Email: confirmación de reservación ────────────────────────────────────────
async function sendReservationConfirmation(reservation) {
  if (!isConfigured()) return;
  const guest = reservation.guest;
  if (!guest?.email) return;

  const body = `
    <h2 style="color:#1e3a5f;margin-top:0">Confirmación de Reservación</h2>
    <p>Estimado/a <strong>${guest.firstName} ${guest.lastName}</strong>,</p>
    <p>Nos complace confirmar su reservación en <strong>${hotelName()}</strong>.</p>

    <table>
      <tr><th colspan="2">Detalle de su estadía</th></tr>
      <tr><td style="color:#666">Reservación N°</td><td><strong>${String(reservation.id).padStart(6, '0')}</strong></td></tr>
      <tr><td style="color:#666">Habitación</td><td>${reservation.room?.roomNumber} — ${reservation.room?.roomType?.name}</td></tr>
      <tr><td style="color:#666">Fecha de entrada</td><td>${reservation.checkInDate}</td></tr>
      <tr><td style="color:#666">Fecha de salida</td><td>${reservation.checkOutDate}</td></tr>
      <tr><td style="color:#666">Noches</td><td>${reservation.nights}</td></tr>
      <tr><td style="color:#666">Huéspedes</td><td>${reservation.adults} adulto(s)${reservation.children > 0 ? `, ${reservation.children} niño(s)` : ''}</td></tr>
      <tr><td style="color:#666">Tarifa / noche</td><td>$${fmt(reservation.ratePerNight)}</td></tr>
      <tr class="total-row"><td>Total hospedaje</td><td>$${fmt(reservation.totalAmount)}</td></tr>
    </table>

    ${reservation.notes ? `<p style="background:#fffde7;padding:10px;border-radius:6px;font-size:14px;">📝 <em>${reservation.notes}</em></p>` : ''}

    <p style="margin-top:24px">Si tiene alguna pregunta o necesita hacer cambios, no dude en contactarnos.</p>
    <p>¡Le esperamos!</p>
  `;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: fromAddr(),
    to: `${guest.firstName} ${guest.lastName} <${guest.email}>`,
    subject: `✅ Confirmación de reservación — ${hotelName()} N° ${String(reservation.id).padStart(6, '0')}`,
    html: baseHtml('Confirmación de Reservación', body)
  });
}

// ── Email: recibo de check-out ────────────────────────────────────────────────
async function sendCheckoutReceipt(reservation, balance) {
  if (!isConfigured()) return;
  const guest = reservation.guest;
  if (!guest?.email) return;

  const totalExtra = (reservation.extraCharges || [])
    .reduce((s, c) => s + parseFloat(c.amount), 0);
  const totalCharges = parseFloat(reservation.totalAmount) + totalExtra;
  const totalPaid    = totalCharges - balance;

  const chargesRows = (reservation.extraCharges || []).map(c =>
    `<tr><td>${c.description}</td><td style="text-align:right">$${fmt(c.amount)}</td></tr>`
  ).join('');

  const paymentRows = (reservation.payments || []).map(p => {
    const method = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' }[p.paymentMethod] || p.paymentMethod;
    const type   = { deposit: 'Anticipo', payment: 'Pago', refund: 'Reembolso' }[p.paymentType] || p.paymentType;
    const sign   = p.paymentType === 'refund' ? '-' : '';
    return `<tr><td>${type} (${method})</td><td style="text-align:right;color:${p.paymentType === 'refund' ? '#c62828' : '#2e7d32'}">${sign}$${fmt(p.amount)}</td></tr>`;
  }).join('');

  const body = `
    <h2 style="color:#1e3a5f;margin-top:0">Recibo de estadía — Check-out</h2>
    <p>Estimado/a <strong>${guest.firstName} ${guest.lastName}</strong>,</p>
    <p>Gracias por hospedarse en <strong>${hotelName()}</strong>. A continuación encontrará el detalle de su cuenta.</p>

    <table>
      <tr><th>Concepto</th><th style="text-align:right">Monto</th></tr>
      <tr>
        <td>Hospedaje — ${reservation.room?.roomType?.name} (${reservation.nights} noches × $${fmt(reservation.ratePerNight)})</td>
        <td style="text-align:right">$${fmt(reservation.totalAmount)}</td>
      </tr>
      ${chargesRows}
      <tr style="border-top:2px solid #eee">
        <td><strong>Total cargos</strong></td>
        <td style="text-align:right"><strong>$${fmt(totalCharges)}</strong></td>
      </tr>
    </table>

    ${paymentRows ? `
    <table>
      <tr><th colspan="2">Pagos recibidos</th></tr>
      ${paymentRows}
      <tr class="total-row">
        <td>Total pagado</td>
        <td style="text-align:right;color:#2e7d32">$${fmt(totalPaid)}</td>
      </tr>
    </table>` : ''}

    <div style="background:${balance > 0 ? '#fff3e0' : '#e8f5e9'};padding:14px;border-radius:6px;text-align:center;margin-top:16px">
      <p style="margin:0;font-size:18px;font-weight:bold;color:${balance > 0 ? '#e65100' : '#1b5e20'}">
        Saldo: ${balance > 0 ? `$${fmt(balance)} pendiente` : `$${fmt(Math.abs(balance))} a su favor`}
      </p>
    </div>

    <p style="margin-top:24px">Esperamos verle pronto. ¡Hasta la próxima!</p>
  `;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: fromAddr(),
    to: `${guest.firstName} ${guest.lastName} <${guest.email}>`,
    subject: `🧾 Recibo de su estadía — ${hotelName()}`,
    html: baseHtml('Recibo de estadía', body)
  });
}

module.exports = { sendReservationConfirmation, sendCheckoutReceipt };
