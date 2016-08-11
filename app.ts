
///<reference path="whatwg-fetch.d.ts" />
import { inflate } from "pako"
import { Database } from "sql.js"
import { localforage } from "localforage"

declare function domBuilder(body: Array<any>, scope? : any) : DocumentFragment;

// https://tech.lds.org/wiki/Gospel_Library_Catalog_Web_Service

// let platform = 1; // iPhone
let platform = 17; // Android

async function fetchJson(url, message) : Promise<any> {
  if (message) console.log(message);
  console.warn("Fetch JSON", url);
  let res = await fetch(url);
  return await res.json();
}

async function fetchBinary(url, message) : Promise<Uint8Array> {
  if (message) console.log(message);
  console.warn("Fetch Binary", url);
  let res = await fetch(url);
  return new Uint8Array(await res.arrayBuffer());
}

async function getLanguage() : Promise<number> {
  let language = await localforage.getItem<number>("language");
  if (language) return language;
  let result = await fetchJson(
    "http://tech.lds.org/glweb?action=languages.query&format=json",
    "Getting list of supported languages..."
  );

  // TODO: display list of languages to user and let them select.
  // It can default to English so that only a quick click/tap is required.
  // We could even detect the user's preference somehow via browser data?
  let languages = result.languages.sort((a,b) => {return a.id - b.id;});
  language = languages[0].id;
  await localforage.setItem("language", language);
  return language;
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

async function getZbook(book : Book) : Promise<Database> {
  let file = await localforage.getItem<BookFile>(book.file);
  if (file) {
    if (file.version !== book.file_version) {
      // Update book in background.
      fetchBinary(
        book.url,
        "Updating book " + book.name + "..."
      ).then(data => {
        file.data = data;
        // TODO: notify UI book has been updated
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

function byDisplayOrder(a, b) {
  return a.display_order - b.display_order;
}

function render(data: Folder) : DocumentFragment {
  let parts = [];
  parts.push(["h1", data.name]);
  for (let folder of data.folders.sort(byDisplayOrder)) {
    parts.push([".folder", folder.name]);
  }
  return domBuilder(parts);
}

window.onload = async function () {
  let catalog = await getCatalog();
  document.body.textContent = "";
  document.body.appendChild(render(catalog));
  // let folder = catalog.folders[0];
  // console.log("folder", folder);
  // let book = folder.books[0];
  // console.log("book", book);
  // let db = await getZbook(book);
  // console.log(db);
  // let res = db.exec("SELECT * FROM node WHERE content IS NOT NULL LIMIT 5")[0];
  // console.log(res);
  // res.values.forEach(function (row) {
  //   let obj:any = {};
  //   res.columns.forEach(function (col, i) {
  //     obj[col] = row[i];
  //   });
  //   console.log(obj);
  //   document.write(obj.content + obj.refs);
  // });
  // console.log(res);
};
