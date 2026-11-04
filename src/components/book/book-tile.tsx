import Link from "next/link";
import { bookHref } from "@/lib/book-ref";
import type { Book } from "@/lib/types";
import { authorLine, cn } from "@/lib/utils";
import { BookCover } from "./book-cover";

export function BookTile({ book, className, note, priority }: { book: Book; className?: string; note?: React.ReactNode; priority?: boolean }) {
  return (
    <Link href={bookHref(book)} className={cn("group block", className)}>
      <BookCover title={book.title} authors={book.authors} coverUrl={book.coverUrl} size="fill" priority={priority} className="transition-transform duration-300 group-hover:-translate-y-1 group-hover:-rotate-1" />
      <p className="mt-2 line-clamp-2 font-serif leading-tight group-hover:text-burgundy">{book.title}</p>
      <p className="meta truncate normal-case tracking-normal">{authorLine(book.authors)}</p>
      {note}
    </Link>
  );
}
