import express from "express";

import indexRouter from "./routes/index";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { requestIdMiddleware, basicRequestLogger } from "./middleware/requestId";

const app = express();

app.use(express.json());

// request id + basic logging
app.use(requestIdMiddleware);
app.use(basicRequestLogger);

app.use("/", indexRouter);

// 404 + centralized error handler (order matters!)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
