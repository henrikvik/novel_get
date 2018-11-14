const cheerio = require("cheerio");
const request = require("request");
const fs = require("fs");

class Parser { };
class SLTParser extends Parser {
    get_chapter_title(body) {
        return body.find(".entry-title").text();
    }

    get_chapter_text(body) {
        let article = body.find("article").clone();
        article.find("div > div").remove();
        return article.html();
    }

    get_next_url(body) {
        let a_next = body.find("a:contains(Next Chapter)");
        return a_next.attr("href");
    }
};

class WuxiaParser extends Parser {
    get_chapter_title(body) {
        return body.find(".caption h4:contains(Chapter)").text();
    }

    get_chapter_text(body) {
        let article = body.find(".p-15 .fr-view");
        return article.html();
    }

    get_next_url(body) {
        let a_next = body.find(".next > a");
        return a_next.attr("href") != "#" ?  "https://www.wuxiaworld.com" + a_next.attr("href") : undefined;
    }
}

function get_chapter(parser, url) {
    return new Promise((resolve, reject) => {
        request.get(url, (err, res, html) => {
            if (err) return reject(err);
            let body = cheerio(html);

            let title = parser.get_chapter_title(body);
            let text = parser.get_chapter_text(body);
            let next = parser.get_next_url(body);

            resolve({ title, text, next });
        });
    });
}


class Book {
    constructor()
    {
        this.chapters = [];
        this.body = "";
    }

    get_progress()
    {
        return this.body.length / (2 * 1024 * 1024);
    }

    add_chapter(chapter)
    {
        if (this.body.length + chapter.text.length > 2 * 1024 * 1024) return false;

        this.chapters.push(chapter);
        this.body += chapter.text + "<hr/>";

        return true;
    }

    save_to_file()
    {
        fs.writeFileSync(
            `books/${this.chapters[0].title} to ${this.chapters[this.chapters.length - 1].title}.html`,
            this.body,
        );
    }

};



function get_chapter_recursive(parser, url, book) {
    book = book || new Book();
    return new Promise((resolve, reject) => {
        get_chapter(parser, url)
            .then(chapter => {
                console.log(`Found Chapter "${chapter.title}", has next ${!!chapter.next}. Book ${
                    Math.floor(book.get_progress() * 1000) / 10
                }% full.`);

                let added = book.add_chapter(chapter);
                if (!added) console.log("Book too big, stopping.");

                return added && chapter.next ? get_chapter_recursive(parser, chapter.next, book) : book;
            }).then(resolve)
            .catch(reject);
    });
}



let url = "";
get_chapter_recursive(new WuxiaParser(), url).then(book => {
    book.save_to_file();
});