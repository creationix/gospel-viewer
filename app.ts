
///<reference path="whatwg-fetch.d.ts" />
import { inflate } from "pako";
import { Database } from "sql.js";

// https://tech.lds.org/wiki/Gospel_Library_Catalog_Web_Service

// let language = 2; // English
let language = "2"; // Español
let platform = "1"; // iPhone
// let platform = 17; // Android

async function fetchJson(url) : Promise<any> {
  let res = await fetch(url);
  return await res.json();
}

async function fetchBinary(url) : Promise<Uint8Array> {
  let res = await fetch(url);
  return new Uint8Array(await res.arrayBuffer());
}

async function getLanguages() {
  console.log("Getting list of supported languages...");
  return await fetchJson(
    "http://tech.lds.org/glweb?action=languages.query&format=json"
  );
}

async function getCatalog() {
  console.log("Checking for catalog update...");
  let update = await fetchJson(
    "http://tech.lds.org/glweb?action=catalog.query.modified&languageid=" +
    language + "&platformid=" + platform + "&format=json"
  );
  let version = update.version;
  if (platform == localStorage.getItem("platform") &&
      language == localStorage.getItem("language") &&
      version == localStorage.getItem("version")) {
    console.log("No update, loading from cache.");
    return JSON.parse(localStorage.getItem("catalog"));
  }
  console.log("Updating catalog...");
  let result = await fetchJson(
    "http://tech.lds.org/glweb?action=catalog.query&languageid=" +
    language + "&platformid=" + platform + "&format=json"
  );
  localStorage.setItem("catalog", JSON.stringify(result.catalog));
  localStorage.setItem("version", version);
  localStorage.setItem("language", language);
  localStorage.setItem("platform", platform);
  return result.catalog;
}

async function getZbook(book) : Promise<Database> {
  let data = await fetchBinary(book.url);
  console.log(data);
  data = inflate(data);
  console.log(data);
  return new Database(data);
}


window.onload = async function () {
  let langs = await getLanguages();
  let catalog = await getCatalog();
  let folder = catalog.folders[0];
  console.log("folder", folder);
  let book = folder.books[0];
  console.log("book", book);
  let db = await getZbook(book);
  console.log(db);
  let res = db.exec("SELECT * FROM nodes WHERE content IS NOT NULL LIMIT 5")[0];
  console.log(res);
  res.values.forEach(function (row) {
    let obj:any = {};
    res.columns.forEach(function (col, i) {
      obj[col] = row[i];
    });
    console.log(obj);
    document.write(obj.content + obj.refs);
  });
  console.log(res);
};
