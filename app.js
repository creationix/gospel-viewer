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
function fetchJson(url, message) {
    return __awaiter(this, void 0, void 0, function* () {
        if (message)
            console.log(message);
        console.warn("Fetch JSON", url);
        let res = yield fetch(url);
        return yield res.json();
    });
}
function fetchBinary(url, message) {
    return __awaiter(this, void 0, void 0, function* () {
        if (message)
            console.log(message);
        console.warn("Fetch Binary", url);
        let res = yield fetch(url);
        return new Uint8Array(yield res.arrayBuffer());
    });
}
function getLanguage() {
    return __awaiter(this, void 0, void 0, function* () {
        let language = yield localforage_1.localforage.getItem("language");
        if (language)
            return language;
        let result = yield fetchJson("http://tech.lds.org/glweb?action=languages.query&format=json", "Getting list of supported languages...");
        let languages = result.languages.sort((a, b) => { return a.id - b.id; });
        language = languages[0].id;
        yield localforage_1.localforage.setItem("language", language);
        return language;
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
function getZbook(book) {
    return __awaiter(this, void 0, void 0, function* () {
        let file = yield localforage_1.localforage.getItem(book.file);
        if (file) {
            if (file.version !== book.file_version) {
                fetchBinary(book.url, "Updating book " + book.name + "...").then(data => {
                    file.data = data;
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
        return new sql_js_1.Database(pako_1.inflate(file.data));
    });
}
function byDisplayOrder(a, b) {
    return a.display_order - b.display_order;
}
function render(data) {
    let parts = [];
    parts.push(["h1", data.name]);
    for (let folder of data.folders.sort(byDisplayOrder)) {
        parts.push([".folder", folder.name]);
    }
    return domBuilder(parts);
}
window.onload = function () {
    return __awaiter(this, void 0, void 0, function* () {
        let catalog = yield getCatalog();
        document.body.textContent = "";
        document.body.appendChild(render(catalog));
    });
};
//# sourceMappingURL=app.js.map