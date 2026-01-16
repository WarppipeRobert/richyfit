import express from "express";

import indexRouter from "./routes/index";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { requestIdMiddleware } from "./middleware/requestId";
import { structuredLogger } from "./middleware/logger";
import docsRoutes from "./routes/docs";

const app = express();

app.use(express.json());

// request id + basic logging
app.use(requestIdMiddleware);
app.use(structuredLogger);

app.use(docsRoutes);
app.use("/", indexRouter);

// 404 + centralized error handler (order matters!)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
