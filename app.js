"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const pako_1 = require("pako");
const sql_js_1 = require("sql.js");
const localforage_1 = require("localforage");
let platform = 17;
let proxy = "https://cors-anywhere.herokuapp.com/";
function fetchJson(url, message) {
    return __awaiter(this, void 0, void 0, function* () {
        if (message)
            console.log(message);
        console.warn("Fetch JSON", url);
        let res = yield fetch(proxy + url);
        return yield res.json();
    });
}
function fetchBinary(url, message) {
    return __awaiter(this, void 0, void 0, function* () {
        if (message)
            console.log(message);
        console.warn("Fetch Binary", url);
        let res = yield fetch(proxy + url);
        return new Uint8Array(yield res.arrayBuffer());
    });
}
function getLanguage() {
    return __awaiter(this, void 0, void 0, function* () {
        return 1;
    });
}
function updateCatalog(language) {
    return __awaiter(this, void 0, void 0, function* () {
        let update = yield fetchJson("http://tech.lds.org/glweb?action=catalog.query.modified&languageid=" +
            language + "&platformid=" + platform + "&format=json", "Checking for catalog updates...");
        let version = update.version;
        if (version == (yield localforage_1.localforage.getItem("version"))) {
            console.log("No catalog updates.");
            return;
        }
        let result = yield fetchJson("http://tech.lds.org/glweb?action=catalog.query&languageid=" +
            language + "&platformid=" + platform + "&format=json", "Downloading catalog...");
        yield localforage_1.localforage.setItem("catalog", result.catalog);
        yield localforage_1.localforage.setItem("version", version);
        yield localforage_1.localforage.setItem("language", language);
        yield localforage_1.localforage.setItem("platform", platform);
        return result.catalog;
    });
}
function getCatalog() {
    return __awaiter(this, void 0, void 0, function* () {
        let language = yield getLanguage();
        let catalog = yield localforage_1.localforage.getItem("catalog");
        if (catalog &&
            platform == (yield localforage_1.localforage.getItem("platform")) &&
            language == (yield localforage_1.localforage.getItem("language"))) {
            updateCatalog(language);
            return catalog;
        }
        return yield updateCatalog(language);
    });
}
let files = {};
function getZbook(book) {
    return __awaiter(this, void 0, void 0, function* () {
        let file = files[book.file];
        if (!file) {
            file = yield localforage_1.localforage.getItem(book.file);
            if (file) {
                if (file.version !== book.file_version) {
                    fetchBinary(book.url, "Updating book " + book.name + "...").then(data => {
                        file.data = data;
                        files[book.file] = file;
                        return localforage_1.localforage.setItem(book.file, file);
                    });
                }
            }
            else {
                file = {
                    version: book.file_version,
                    data: yield fetchBinary(book.url, "Downloading book " + book.name + "...")
                };
                yield localforage_1.localforage.setItem(book.file, file);
            }
        }
        return new sql_js_1.Database(pako_1.inflate(file.data));
    });
}
function query(db, sql) {
    let results = db.exec(sql);
    if (!results[0])
        return;
    let rows = [];
    results[0].values.forEach(function (row) {
        let obj = {};
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
function renderBreadcrumbs(parents) {
    return [".nav", parents.map((parent, i) => {
            return ["span.crumb", { onclick: go }, parent.name];
            function go(evt) {
                evt.preventDefault();
                parents.length = i + 1;
                renderFolder(parents);
            }
        })];
}
function renderIndex(book, folders, nodes) {
    return __awaiter(this, void 0, void 0, function* () {
        let parts = [];
        parts.push(renderBreadcrumbs(folders));
        parts[parts.length - 1] = parts[parts.length - 1].concat(nodes.map((node, i) => {
            return ["span.crumb", { onclick: go, html: node.title }];
            function go(evt) {
                evt.preventDefault();
                nodes.length = i + 1;
                renderIndex(book, folders, nodes);
            }
        }));
        parts.push([".loading", "Loading..."]);
        document.body.textContent = "";
        document.body.appendChild(domBuilder(parts));
        parts.pop();
        let db = yield getZbook(book);
        let parentId = nodes.length ? nodes[nodes.length - 1].id : 0;
        let toc = query(db, "SELECT id, title, uri FROM node WHERE parent_id = " + parentId);
        if (toc) {
            toc.forEach(entry => {
                parts.push([".doc", { onclick: read, html: entry.title }]);
                function read(evt) {
                    evt.preventDefault();
                    console.log(entry);
                    nodes.push(entry);
                    renderIndex(book, folders, nodes);
                }
            });
        }
        let self = query(db, "SELECT content FROM node WHERE id = " + parentId);
        if (self) {
            let css = query(db, "SELECT css FROM css")[0].css;
            parts.push(['style', css]);
            parts.push(["div", { html: self[0].content }]);
        }
        document.body.textContent = "";
        document.body.appendChild(domBuilder(parts));
    });
}
function renderFolder(folders) {
    let parts = [];
    let folder = folders[folders.length - 1];
    parts.push(renderBreadcrumbs(folders));
    folder.folders.sort(byDisplayOrder).forEach(function (child) {
        parts.push([".folder", { onclick: onClick }, child.name]);
        function onClick(evt) {
            evt.preventDefault();
            folders.push(child);
            renderFolder(folders);
        }
    });
    folder.books.sort(byDisplayOrder).forEach(function (book) {
        parts.push([".book", { onclick: onClick }, book.name]);
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
window.onload = function () {
    return __awaiter(this, void 0, void 0, function* () {
        let catalog = yield getCatalog();
        let folder = catalog.folders[0];
        let book = folder.books[0];
        renderIndex(book, [catalog, folder], [{
                id: 0,
                title: book.name,
                uri: book.gl_uri
            }]);
    });
};
//# sourceMappingURL=app.js.map