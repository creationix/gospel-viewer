
///<reference path="whatwg-fetch.d.ts" />
import { inflate } from "pako"
import { Database } from "sql.js"
import { localforage } from "localforage"

declare function domBuilder(body: Array<any>, scope? : any) : DocumentFragment;

// https://tech.lds.org/wiki/Gospel_Library_Catalog_Web_Service

// let platform = 1; // iPhone
let platform = 17; // Android

// CORS proxy
// You can disable this by setting it to empty string and instead using
// a browser extension that injects cors headers.
let proxy = "https://cors-anywhere.herokuapp.com/";

async function fetchJson(url, message) : Promise<any> {
  if (message) console.log(message);
  console.warn("Fetch JSON", url);
  let res = await fetch(proxy + url);
  return await res.json();
}

async function fetchBinary(url, message) : Promise<Uint8Array> {
  if (message) console.log(message);
  console.warn("Fetch Binary", url);
  let res = await fetch(proxy + url);
  return new Uint8Array(await res.arrayBuffer());
}

async function getLanguage() : Promise<number> {
  return 1;
  // let language = await localforage.getItem<number>("language");
  // if (language) return language;
  // let result = await fetchJson(
  //   "http://tech.lds.org/glweb?action=languages.query&format=json",
  //   "Getting list of supported languages..."
  // );
  //
  // // TODO: display list of languages to user and let them select.
  // // It can default to English so that only a quick click/tap is required.
  // // We could even detect the user's preference somehow via browser data?
  // let languages = result.languages.sort((a,b) => {return a.id - b.id;});
  // language = languages[0].id;
  // await localforage.setItem("language", language);
  // return language;
}


async function updateCatalog(language) : Promise<Folder> {
  let update = await fetchJson(
    "http://tech.lds.org/glweb?action=catalog.query.modified&languageid=" +
    language + "&platformid=" + platform + "&format=json",
    "Checking for catalog updates..."
  );
  let version = update.version;
  if (version == await localforage.getItem("version")) {
    console.log("No catalog updates.");
    return;
  }
  let result = await fetchJson(
    "http://tech.lds.org/glweb?action=catalog.query&languageid=" +
    language + "&platformid=" + platform + "&format=json",
    "Downloading catalog..."
  );
  await localforage.setItem("catalog", result.catalog);
  await localforage.setItem("version", version);
  await localforage.setItem("language", language);
  await localforage.setItem("platform", platform);
  // TODO: use book.versions API to update any downloaded books.
  return result.catalog;
}

async function getCatalog() {
  let language = await getLanguage();
  let catalog = await localforage.getItem<Folder>("catalog");
  if (catalog &&
      platform == await localforage.getItem("platform") &&
      language == await localforage.getItem("language")) {
    updateCatalog(language); // check for update in background
    return catalog; // But return cached value immediately
  }
  return await updateCatalog(language);
}

interface BookFile {
  version: string,
  data: Uint8Array
}

let files = {};
async function getZbook(book : Book) : Promise<Database> {
  let file = files[book.file];
  if (!file) {
    file = await localforage.getItem<BookFile>(book.file);
    if (file) {
      if (file.version !== book.file_version) {
        // Update book in background.
        fetchBinary(
          book.url,
          "Updating book " + book.name + "..."
        ).then(data => {
          file.data = data;
          // TODO: notify UI book has been updated
          files[book.file] = file;
          return localforage.setItem(book.file, file);
        });
      }
    }
    else {
      file = {
        version: book.file_version,
        data: await fetchBinary(
          book.url,
          "Downloading book " + book.name + "..."
        )
      };
      await localforage.setItem(book.file, file);
    }
  }

  return new Database(inflate(file.data));
}

interface Folder {
  folders: Folder[];
  books: Book[];
  display_order: number;
  eng_name?: string;
  name: string;
}

interface Book {
  file: string;
  file_version: string;
  url: string;
  name: string;
  full_name: string;
  description: string;
  gl_uri: string;
}

interface Node {
  id : number;
  title : string;
  uri : string;
}

function query<T>(db, sql) : Array<T> {
  let results = db.exec(sql);
  if (!results[0]) return;
  let rows : Array<T> = [];
  results[0].values.forEach(function (row) {
    let obj = {} as T;
    rows.push(obj);
    results[0].columns.forEach(function (col, i) {
      obj[col] = row[i];
    });
  });
  return rows;
}

function byDisplayOrder(a, b) {
  return a.display_order - b.display_order;
}

function renderBreadcrumbs(parents: Folder[]) : Array<any> {
  return [".nav", parents.map((parent, i) => {
    return ["span.crumb", {onclick:go}, parent.name]
    function go(evt) {
      evt.preventDefault();
      parents.length = i + 1;
      renderFolder(parents);
    }
  })];
}


async function renderIndex(book: Book, folders: Folder[], nodes: Node[]) {
  let parts = [];
  parts.push(renderBreadcrumbs(folders));
  parts[parts.length - 1] = parts[parts.length - 1].concat(
    nodes.map((node, i) => {
     return ["span.crumb", {onclick:go,html: node.title}]
     function go(evt) {
       evt.preventDefault();
       nodes.length = i + 1;
       renderIndex(book, folders, nodes);
     }
    })
  );
  parts.push([".loading", "Loading..."]);
  document.body.textContent = "";
  document.body.appendChild(domBuilder(parts));
  parts.pop();

  let db = await getZbook(book);


  let parentId = nodes.length ? nodes[nodes.length - 1].id : 0;

  // Get the TOC entries for the desired parent node.
  let toc = query<Node>(db,
    "SELECT id, title, uri FROM node WHERE parent_id = " + parentId
  );
  if (toc) {
    toc.forEach(entry => {
      parts.push([".doc", {onclick:read, html: entry.title}]);
      function read(evt) {
        evt.preventDefault();
        console.log(entry);
        nodes.push(entry);
        renderIndex(book, folders, nodes);
      }
    });
  }

  let self = query<{content:string}>(db, "SELECT content FROM node WHERE id = " + parentId);
  if (self) {
    // Load book provided CSS
    let css = query<{ css: string}>(db, "SELECT css FROM css")[0].css;
    parts.push(['style', css]);

    parts.push(["div", {html:self[0].content}]);
  }



  document.body.textContent = "";
  document.body.appendChild(domBuilder(parts));
}


function renderFolder(folders: Folder[]) {
  let parts = [];
  let folder = folders[folders.length - 1];
  parts.push(renderBreadcrumbs(folders));
  folder.folders.sort(byDisplayOrder).forEach(function (child) {
    parts.push([".folder", {onclick: onClick}, child.name]);
    function onClick(evt) {
      evt.preventDefault();
      folders.push(child);
      renderFolder(folders);
    }
  });
  folder.books.sort(byDisplayOrder).forEach(function (book) {
    parts.push([".book", {onclick: onClick}, book.name]);
    function onClick(evt) {
      evt.preventDefault();
      renderIndex(book, folders, [{
        id: 0,
        title: book.name,
        uri: book.gl_uri
      }]);
    }
  });
  document.body.textContent = "";
  document.body.appendChild(domBuilder(parts));
}

window.onload = async function () {
  let catalog = await getCatalog();
  let folder = catalog.folders[0];
  let book = folder.books[0];
  renderIndex(book, [catalog, folder], [{
    id: 0,
    title: book.name,
    uri: book.gl_uri
  }]);
};
