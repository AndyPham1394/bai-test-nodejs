const myName = window.location.search.replace(/\?user=/gi, "").trim();
var socket = io("/");
socket.on("disconnect", () => {
  location.reload(); // reload page khi websocket mất kết nối
});
/* init socket.io */
socket.emit("assign", myName);
socket.emit("joinRoom", "test");
socket.emit("get-users-list");
socket.emit("get-room-messages", "test");
var userList = [];
socket.on("users-list", function (data) {
  if (Array.isArray(data)) {
    userList = data;
    userList.forEach((element) => {
      addRelateBar(element.userName ? element.userName : "");
    });
  }
});
// các message trong room được return sau khi ta gửi "get-room-messages" event
const roomMessages = [];
socket.on("room-messages", (data) => {
  data.data.forEach((element) => {
    try {
      let parse = JSON.parse(element);
      roomMessages.push(parse);
      if (parse.from === myName) {
        displayOurMessage(parse.mes, parse.time);
      } else {
        displayTheirMessage(parse.mes, parse.time, parse.from + "-");
      }
    } catch (err) {
      console.log(err);
    }
  });
});
// events khi nhận được message từ server
socket.on("room-message", (message) => {
  if (
    message.hasOwnProperty("rName") &&
    message.hasOwnProperty("mes") &&
    message.hasOwnProperty("from")
  ) {
    let time = new Date();
    displayTheirMessage(message.mes, time, message.from + "-");
  }
});
socket.on("join-room", (data) => {
  console.log(`${data.userId} joined room :${data.roomName}`);
});
socket.on("leave-room", (data) => {
  console.log(`${data.userId} leave room :${data.roomName}`);
});
/* socket.io init end */

/** Hiển thị */
const relateBar = document.getElementById("relateBar");
const commentBox = document.getElementById("comment");
const messageBox = document.getElementById("conversation");
const sendButton = document.getElementById("button");
var onFocus = "test";

function displayMessage(content, timeString, theirName, sendOrReceive) {
  let float = "";
  if (sendOrReceive && content.length < 39) {
    float = "style='float:right'";
  } else if (!sendOrReceive && content.length < 64) {
    float = "style='float:left'";
  }
  let sr = "receiver";
  if (sendOrReceive) sr = "sender";
  var message = document.createElement("div");
  message.className = "row message-body";
  message.innerHTML =
    '<div class="message-main-' +
    sr +
    '"><div ' +
    float +
    'class="' +
    sr +
    '"><div class="message-text">' +
    content +
    '</div><span class="message-time pull-right">' +
    theirName +
    "" +
    timeString +
    "</span></div></div>";
  messageBox.appendChild(message).scrollIntoView();
}

function addRelateBar(name) {
  var avatar = "man-2-512.png";
  let relate = document.createElement("div");
  relate.className = "row sideBar-body";
  relate.innerHTML =
    '<div class="col-sm-3 col-xs-3 sideBar-avatar">' +
    '<div class="avatar-icon">' +
    "<img src=" +
    avatar +
    '></div></div><div class="col-sm-9 col-xs-9 sideBar-main">' +
    '<div class="row"><div class="col-sm-8 col-xs-8 sideBar-name"' +
    `id="${name}-relateBar"` +
    '><span class="name-meta">' +
    name +
    "</span></div></div></div></div>";
  relateBar.appendChild(relate);
}

function displayOurMessage(content, time) {
  let timeString = new Date(time).toLocaleTimeString();
  displayMessage(content, timeString, "", true);
}

function displayTheirMessage(content, time, theirName) {
  let timeString = new Date(time).toLocaleTimeString();
  displayMessage(content, timeString, theirName, false);
}
function clearRelationsBar() {
  relateBar.innerHTML = "";
}

function sendAction() {
  commentBox.value = commentBox.value.replaceAll(/\n/g, "");
  commentBox.value = commentBox.value.trim();
  if (commentBox.value.length > 0) {
    let time = new Date();
    socket.emit("room-message", {
      roomName: onFocus,
      message: commentBox.value,
    });
    displayOurMessage(commentBox.value, time);
  }
  commentBox.value = "";
}
sendButton.addEventListener("click", function () {
  sendAction();
});
commentBox.addEventListener("keyup", function (event) {
  event.preventDefault();
  if (event.keyCode === 13) {
    sendAction();
  }
});
