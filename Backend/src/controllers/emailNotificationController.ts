export interface OrderEmailItem {
    name: string;
    quantity: number;
    price: number;
}

export type OrderEmailType = "created" | "accepted" | "rejected";

export interface OrderEmailData {
    to: string;
    userName?: string | null;
    requestId: string;
    createdAt: Date | string;
    totalAmount: number;
    items: OrderEmailItem[];
    adminMessage?: string | null;
}

const formatCRC = (n: number) =>
    new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC" }).format(n);

/* El mensaje del admin es texto libre: se escapa para que no pueda inyectar HTML en el correo */
const escapeHtml = (s: string) =>
    s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const CONTENT: Record<
    OrderEmailType,
    { title: string; color: string; intro: string; subject: string; footer: string }
> = {
    created: {
        title: "¡Recibimos tu solicitud de pedido!",
        color: "#2f6b3a",
        intro: "tu solicitud está <strong>pendiente de aprobación</strong>. Te avisaremos cuando sea revisada.",
        subject: "Recibimos tu solicitud de pedido",
        footer: "El pago se realiza en el vivero al retirar tu pedido.",
    },
    accepted: {
        title: "¡Tu pedido fue aceptado!",
        color: "#2f6b3a",
        intro: "tu pedido fue <strong>aceptado</strong>.",
        subject: "Tu pedido fue aceptado",
        footer: "El pago se realiza en el vivero al retirar tu pedido.",
    },
    rejected: {
        title: "Tu pedido fue rechazado",
        color: "#b3261e",
        intro: "lamentablemente tu pedido fue <strong>rechazado</strong>.",
        subject: "Tu pedido fue rechazado",
        footer: "",
    },
};

export async function sendOrderEmail(type: OrderEmailType, data: OrderEmailData) {
    const c = CONTENT[type];
    const shortId = data.requestId.slice(0, 8);

    const rows = data.items
        .map(
            (i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(i.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatCRC(i.price)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatCRC(i.price * i.quantity)}</td>
      </tr>`
        )
        .join("");

    const adminMessage = data.adminMessage?.trim();
    const messageBlock = adminMessage
        ? `
      <div style="margin:16px 0;padding:12px 16px;background:#f7f7f7;border-left:4px solid ${c.color};">
        <strong>Mensaje del vivero:</strong><br/>
        ${escapeHtml(adminMessage).replace(/\n/g, "<br/>")}
      </div>`
        : "";

    const footerBlock = c.footer
        ? `<p style="color:#666;font-size:13px;">${c.footer}</p>`
        : "";

    const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
      <h2 style="color:${c.color};">${c.title}</h2>
      <p>Hola${data.userName ? ` ${escapeHtml(data.userName)}` : ""}, ${c.intro}</p>
      ${messageBlock}
      <p><strong>Pedido:</strong> #${shortId}<br/>
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
      ${footerBlock}
    </div>`;

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": process.env.BREVO_API_KEY ?? "",
            "Content-Type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify({
            sender: { name: "Raíces", email: process.env.EMAIL_FROM },
            to: [{ email: data.to }],
            subject: `${c.subject} #${shortId}`,
            htmlContent: html,
        }),
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Brevo respondió ${response.status}: ${detail}`);
    }
}

/* Se mantiene con la misma firma para no tocar el controller de createRequest */
export function sendOrderCreatedEmail(data: OrderEmailData) {
    return sendOrderEmail("created", data);
}