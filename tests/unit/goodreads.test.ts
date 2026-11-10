import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsv, parseGoodreads } from "../../src/lib/goodreads.ts";

const HEADER = "Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies";

test("CSV: quotes, doubled quotes, commas and newlines inside fields", () => {
  assert.deepEqual(parseCsv('a,"b, c","say ""hi""","line\nbreak"\r\n1,2,3,4\n'), [["a", "b, c", 'say "hi"', "line\nbreak"], ["1", "2", "3", "4"]]);
});

test("Goodreads rows: ISBN wrappers, ratings, shelves, dates and tags", () => {
  const csv = [
    HEADER,
    '1,"Piranesi","Susanna Clarke","Clarke, Susanna",,"=""1635575966""","=""9781635575965""",5,4.2,Bloomsbury,Hardcover,272,2020,2020,2021/03/07,2021/01/02,"fantasy, favourites",,read,"Loved it",,,1,0',
    '2,"Circe","Madeline Miller","Miller, Madeline",,"=""""","=""""",0,4.3,Little Brown,Paperback,393,2018,2018,,2022/01/01,,,to-read,,,,0,0',
    '3,"Odd Shelf","Some One","One, Some",,,,3,3,,,,,,,,,,owned,,,,0,0',
  ].join("\n");
  const r = parseGoodreads(csv);
  assert.ok("rows" in r);
  const [p, c, odd] = r.rows;
  assert.deepEqual(
    { isbn: p.isbn, isbn13: p.isbn13, rating: p.rating, shelf: p.shelf, dateRead: p.dateRead, shelves: p.shelves },
    { isbn: "1635575966", isbn13: "9781635575965", rating: 5, shelf: "read", dateRead: "2021-03-07", shelves: ["fantasy", "favourites"] },
  );
  assert.deepEqual({ isbn: c.isbn, rating: c.rating, shelf: c.shelf, dateRead: c.dateRead }, { isbn: null, rating: null, shelf: "want_to_read", dateRead: null });
  assert.equal(odd.shelf, null);
  assert.equal(odd.exclusiveShelf, "owned");
});

test("not a Goodreads file: a clear message", () => {
  assert.ok("error" in parseGoodreads("name,email\nA,b@c.d"));
});
