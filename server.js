const cluster = require("cluster");
if (cluster.isPrimary) {
  /**
   * cluster module sử dụng phương pháp tiếp nhận new connection mặc định là Round Robin
   * ( ngoại trừ hệ điều hành window, cluster trong window thường không sử dụng
   *  được hết tiềm năng của cpu )
   */
  for (let x = 0; x < 4; x++) {
    cluster.fork().on("message", function (message) {
      // mỗi khi child-process gửi data đến thì broadcast data đó đến các child khác
      for (const worker of Object.values(cluster.workers)) {
        worker.send(message);
      }
    });
  }
  cluster.on("fork", (worker) => {
    console.log("forked child-process with id: ", worker.id);
  });
  cluster.on("exit", (process, code, signal) => {
    console.log("process id : " + process.id + " exited!");
    cluster.fork(); // tạo lại 1 child process khác nếu có process exit
  });
  cluster.on("error", () => {});
} else if (cluster.isWorker) {
  const express = require("express");
  const app = express();
  const http = require("http");
  const server = http.createServer(app);
  const { Server } = require("socket.io");
  const io = new Server(server, {
    cors: {
      origin: "http://localhost",
      methods: ["GET", "POST"],
      transports: ["websocket", "polling"],
      credentials: true,
    },
    allowEIO3: true,
  });
  const redisAdapter = require("socket.io-redis");
  io.adapter(redisAdapter({ host: "localhost", port: 6379 }));
  app.use(express.static("statics"));
  const { createClient } = require("redis");
  const client = createClient();
  client.connect();
  client.on("connect", async () => {
    /**
     * table chứa name và id của client, mỗi khi master process thông báo có new user
     * thì push data đó vào bảng này, mỗi child-process có một bảng
     */
    var usersTable = [];
    process.on("message", (message) => {
      if (
        Object.hasOwn(message, "userName") &&
        Object.hasOwn(message, "userId") &&
        Object.hasOwn(message, "command")
      ) {
        if (message.command === "adduser") {
          delete message.command;
          usersTable.push(message);
        } else {
          delete message.command;
          let index = usersTable.findIndex(
            (element) => element.userId === message.userId
          );
          if (index !== -1) {
            usersTable.splice(index, 1);
          }
        }
      }
    });
    /**
     * Socket.io middleware
     */
    io.use((socket, next) => {
      // làm gì đó trước khi chấp nhận connection từ socket này
      next();
    });
    /** Socket.io */
    io.on("connection", (socket) => {
      socket.on("assign", (name) => {
        if (!name) return;
        socket.userName = name;
        process.send({
          command: "adduser",
          userId: socket.id,
          userName: name,
        });
      });
      socket.on("get-users-list", () => {
        if (usersTable.length > 0) {
          socket.emit("users-list", usersTable);
        }
      });
      socket.on("get-room-messages", async (roomName) => {
        if (roomName) {
          // get message trong redis storage
          let data = await client.lRange(roomName, 0, -1);
          let payload = {
            room: roomName,
            data: data,
          };
          socket.emit("room-messages", payload);
        }
      });
      socket.on("joinRoom", (roomName) => {
        if (!socket.userName || !roomName) return;
        socket.join(roomName);
      });
      socket.on("leaveRoom", (roomName) => {
        if (!roomName) return;
        socket.leave(roomName);
      });
      socket.on("room-message", ({ roomName, message }) => {
        if (!roomName || !message || !socket.userName) return;
        // emit message tới những socket instance khác trong room ngoại trừ người gửi
        socket.broadcast.to(roomName).emit("room-message", {
          rName: roomName,
          from: socket.userName,
          mes: message,
        });
        // push message vào redis storage
        client.rPush(
          "test",
          JSON.stringify({
            from: socket.userName,
            mes: message,
            time: new Date(),
          })
        );
      });
      /**
     khi kết nối với server, socket sẽ được tạo 1 room mặc định với tên : socket.id
     các socket khác có thể dùng tên này để emit đến 1 socket cụ thể
    */
      socket.on("disconnect", () => {
        process.send({
          command: "deleteuser",
          userId: socket.id,
          userName: socket.userName ? socket.userName : "",
        });
      });
    });
    //events sảy ra khi có socket join room
    io.of("/").adapter.on("join-room", (room, id) => {
      if (room !== id) {
        let payload = {
          roomName: room,
          userId: id,
        };
        io.to(room).emit("join-room", payload);
      }
    });
    //events sảy ra khi có socket leave room
    io.of("/").adapter.on("leave-room", (room, id) => {
      if (room !== id) {
        let payload = {
          roomName: room,
          userId: id,
        };
        io.to(room).emit("leave-room", payload);
      }
    });
    server.listen(3000);
  });
}
