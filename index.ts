import axios from "axios";
import cors from "cors";
import express, { Request, Response } from "express";
import http from "http";
import mysql from "mysql2";
import { Server } from "socket.io";

type Data = {
  userName: string;
  userId: string;
  message: string;
  roomId: string;
};

const encryptedWidgetSecretKey =
  "Basic " + Buffer.from(process.env.widgetSecretKey + ":").toString("base64");

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const port = Number(process.env.PORT) || 3000;
const host = "0.0.0.0";

const pool = mysql.createPool({
  host: "ballang.c3w48c2yot7a.ap-northeast-2.rds.amazonaws.com",
  user: "admin",
  password: "dPflsdktkfkdgo1!",
  database: "ballang",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
const promisePool = pool.promise();

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log(`a user connected: ${socket.id}`);

  socket.on("join_room", ({ userName, room }) => {
    console.log(`${userName} join ${room}`);
    socket.join(room);
  });

  socket.on("send_msg", async ({ userName, message, userId, roomId }) => {
    const data: Data = {
      userName,
      message,
      userId,
      roomId,
    };
    socket.to(roomId).emit("receive_msg", data);
    try {
      await promisePool.query("INSERT INTO chats SET ?", data);
    } catch (error) {
      console.log(error);
    }
  });
});

server.listen(port, host, () => {
  console.log(`Server running on http://localhost:${port}`);
});

app.get("/", (req: Request, res: Response) => {
  res.send("hello예린");
});

app.get("/chats", async (req: Request, res: Response) => {
  const roomId = req.query.roomId;

  try {
    const [rows] = await promisePool.query(
      `SELECT * FROM chats WHERE roomId = ?`,
      [roomId]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.log(error);
  }
});

app.get("/rooms", async (req: Request, res: Response) => {
  try {
    const [rows] = await promisePool.query("SELECT DISTINCT roomId FROM chats");
    res.status(200).json(rows);
  } catch (error) {
    console.log(error);
  }
});

app.post("/toss", async (req: Request, res: Response) => {
  const { paymentKey, orderId, amount } = req.body;

  try {
    const response = await axios.post(
      "https://api.tosspayments.com/v1/payments/confirm",
      { orderId, amount, paymentKey },
      {
        headers: {
          Authorization: encryptedWidgetSecretKey,
        },
      }
    );
    const result = await response.data;
    res.status(response.status).json(result);
  } catch (error) {
    console.error(error);
  }
});
