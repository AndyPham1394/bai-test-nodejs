# de-bai-test-nodejs

# localhost:3000

# start server : npm run start

# setup packages : npm run setup

server sử dụng cluster module để fork 4 child-process, các child-process này sẽ tạo các websocket server bằng websocket.io
và dùng expressjs để cung cấp các static files, sử dụng redis-adapter để chuyển data và quản lý websocket clients giữa các
child-process với nhau, master-process chỉ làm nhiệm vụ chuyển các message qua lại giữa các child-process với nhau.
Các child-process mặc định sử dụng Round Robin method để thay nhau sử lý các connection từ clients.
