const url = require('url');

// Node version in Ubuntu 16.04 does not know about URL class
function getJsonFromUrl(url)
{
  const query = url.substr(2); //starts with "/?"
  let result = {};
  query.split("&").forEach((part) => {
    const item = part.split("=");
    result[item[0]] = decodeURIComponent(item[1]);
  });
  return result;
}

module.exports = function(wss) {
  let clients = {}; //associative array sid --> socket
  wss.on("connection", (socket, req) => {
    const query = getJsonFromUrl(req.url);
    const sid = query["sid"];
    if (!!clients[sid])
      return socket.send(JSON.stringify({code:"duplicate"}));
    clients[sid] = {sock: socket, page: query["page"]};
    const notifyRoom = (page,code,obj={},excluded=[]) => {
      Object.keys(clients).forEach(k => {
        if (k in excluded)
          return;
        if (k != sid && clients[k].page == page)
        {
          clients[k].sock.send(JSON.stringify(Object.assign(
            {code:code, from:sid}, obj)));
        }
      });
    };
    notifyRoom(query["page"], "connect"); //Hall or Game
    if (query["page"].indexOf("/game/") >= 0)
      notifyRoom("/", "connect"); //notify main hall
    socket.on("message", objtxt => {
      let obj = JSON.parse(objtxt);
      if (!!obj.target && !clients[obj.target])
        return; //receiver not connected, nothing we can do
      switch (obj.code)
      {
        case "pollclients":
          const curPage = clients[sid].page;
          socket.send(JSON.stringify({code:"pollclients",
            sockIds: Object.keys(clients).filter(k => k != sid &&
              (clients[k].page == curPage ||
              // Consider that people playing are in Hall too:
              (curPage == "/" && clients[k].page.indexOf("/game/") >= 0))
            )}));
          break;
        case "pagechange":
          notifyRoom(clients[sid].page, "disconnect");
          if (clients[sid].page.indexOf("/game/") >= 0)
            notifyRoom("/", "disconnect");
          clients[sid].page = obj.page;
          notifyRoom(obj.page, "connect");
          if (obj.page.indexOf("/game/") >= 0)
            notifyRoom("/", "connect");
          break;
        case "askidentity":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"askidentity",from:sid}));
          break;
        case "askchallenge":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"askchallenge",from:sid}));
          break;
        case "askgames":
        {
          // Check all clients playing, and send them a "askgame" message
          let gameSids = {}; //game ID --> [sid1, sid2]
          const regexpGid = /\/[a-zA-Z0-9]+$/;
          Object.keys(clients).forEach(k => {
            if (k != sid && clients[k].page.indexOf("/game/") >= 0)
            {
              const gid = clients[k].page.match(regexpGid)[0];
              if (!gameSids[gid])
                gameSids[gid] = [k];
              else
                gameSids[gid].push(k);
            }
          });
          // Request only one client out of 2 (TODO: this is a bit heavy)
          // Alt: ask game to all, and filter later?
          Object.keys(gameSids).forEach(gid => {
            const L = gameSids[gid].length;
            const idx = L > 1
              ? Math.floor(Math.random() * Math.floor(L))
              : 0;
            const rid = gameSids[gid][idx];
            clients[rid].sock.send(JSON.stringify(
              {code:"askgame", from: sid}));
          });
          break;
        }
        case "askfullgame":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"askfullgame", from:sid}));
          break;
        case "fullgame":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"fullgame", game:obj.game}));
          break;
        case "identity":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"identity",user:obj.user}));
          break;
        case "refusechallenge":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"refusechallenge", cid:obj.cid, from:sid}));
          break;
        case "deletechallenge":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"deletechallenge", cid:obj.cid, from:sid}));
          break;
        case "newgame":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"newgame", gameInfo:obj.gameInfo, cid:obj.cid}));
          break;
        case "challenge":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"challenge", chall:obj.chall, from:sid}));
          break;
        case "game":
          if (!!obj.target)
          {
            clients[obj.target].sock.send(JSON.stringify(
              {code:"game", game:obj.game, from:sid}));
          }
          else
          {
            // Notify all room except opponent and me:
            notifyRoom("/", "game", {game:obj.game}, [obj.oppsid]);
          }
          break;
        case "newchat":
          // WARNING: do not use query["page"], because the page may change
          notifyRoom(clients[sid].page, "newchat",
            {msg: obj.msg, name: obj.name});
          break;
        // TODO: WebRTC instead in this case (most demanding?)
        case "newmove":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"newmove", move:obj.move}));
          break;
        case "lastate":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"lastate", state:obj.state}));
          break;
        case "resign":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"resign"}));
          break;
        case "abort":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"abort",msg:obj.msg}));
          break;
        case "drawoffer":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"drawoffer"}));
          break;
        case "draw":
          clients[obj.target].sock.send(JSON.stringify(
            {code:"draw"}));
          break;
      }
    });
    socket.on("close", () => {
      const page = clients[sid].page;
      delete clients[sid];
      notifyRoom(page, "disconnect");
      if (page.indexOf("/game/") >= 0)
        notifyRoom("/", "disconnect"); //notify main hall
    });
  });
}
