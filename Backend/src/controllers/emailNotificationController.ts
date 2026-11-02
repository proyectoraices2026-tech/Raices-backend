import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

export interface OrderEmailItem {
    name: string;
    quantity: number;
    price: number;
}

export interface OrderEmailData {
    to: string;
    userName?: string | null;
    requestId: string;
    createdAt: Date | string;
    totalAmount: number;
    items: OrderEmailItem[];
}

const formatCRC = (n: number) =>
    new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC" }).format(n);

export async function sendOrderCreatedEmail(data: OrderEmailData) {
    const rows = data.items
        .map(
            (i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${i.name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatCRC(i.price)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatCRC(i.price * i.quantity)}</td>
      </tr>`
        )
        .join("");

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
      <h2 style="color:#2f6b3a;">¡Recibimos tu solicitud de pedido!</h2>
      <p>Hola${data.userName ? ` ${data.userName}` : ""}, tu solicitud está <strong>pendiente de aprobación</strong>. Te avisaremos cuando sea revisada.</p>
      <p><strong>Pedido:</strong> #${data.requestId.slice(0, 8)}<br/>
         <strong>Fecha:</strong> ${new Date(data.createdAt).toLocaleString("es-CR")}</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f3f7f3;">
            <th style="padding:8px;text-align:left;">Producto</th>
            <th style="padding:8px;">Cant.</th>
            <th style="padding:8px;text-align:right;">Precio</th>
            <th style="padding:8px;text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="text-align:right;font-size:18px;"><strong>Total: ${formatCRC(data.totalAmount)}</strong></p>
      <p style="color:#666;font-size:13px;">El pago se realiza en el vivero al retirar tu pedido.</p>
    </div>`;

    await transporter.sendMail({
        from: `Raíces <${process.env.GMAIL_USER}>`,
        to: data.to,
        subject: `Recibimos tu solicitud de pedido #${data.requestId.slice(0, 8)}`,
        html,
    });
}