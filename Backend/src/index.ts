import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./env.js";

const app = express();
const PORT = env.PORT;

// Middlewares globales
app.use(helmet());
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "https://raices-desarrollo.vercel.app",
        ],
        credentials: true,
    })
);
app.use(express.json());

// Healthcheck — útil para confirmar que Railway lo tiene corriendo
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

// Rutas (se agregan a medida que las construyamos)
// app.use("/api/orders", ordersRouter);

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});