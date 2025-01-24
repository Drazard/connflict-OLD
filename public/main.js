///start socket
var socket = io.connect()

socket.on("connect", () => {
  const engine = socket.io.engine;
  console.log(engine.transport.name); // in most cases, prints "polling"

  engine.once("upgrade", () => {
    // called when the transport is upgraded (i.e. from HTTP long-polling to WebSocket)
    console.log(engine.transport.name); // in most cases, prints "websocket"
  });

  engine.on("packet", ({ type, data }) => {
    // called for each packet received
    console.log(type, data)
  });

  engine.on("packetCreate", ({ type, data }) => {
    // called for each packet sent
    console.log(type, data)
  });

  engine.on("drain", () => {
    // called when the write buffer is drained
    console.log("drain")
  });

  engine.on("close", (reason) => {
    // called when the underlying connection is closed
    console.log(reason)
  });
});

socket.onAny("data", () => {
     /* ... */ 
    });

socket.on("disconnect", (reason) => {
    if (reason === "io server disconnect") {
      // the disconnection was initiated by the server, you need to reconnect manually
      socket.connect();
    }
    // else the socket will automatically try to reconnect
    });