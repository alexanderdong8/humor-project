import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Joke } from "@/lib/jokes";
import { createClient } from "@/lib/supabase/server";
import styles from "./jokes.module.css";

export const metadata: Metadata = {
  title: "Jokes",
  description: "Jokes stored in Supabase, rendered for Assignment 2 of the Humor Project.",
};

const PAGE_SIZE = 9;

function pageHref(page: number) {
  return page === 1 ? "/jokes" : `/jokes?page=${page}`;
}

export default async function JokesPage(props: PageProps<"/jokes">) {
  // Reading searchParams renders on every request, so new rows show up without a redeploy.
  const { page: pageParam } = await props.searchParams;
  const requested = Number(Array.isArray(pageParam) ? pageParam[0] : pageParam);
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data: jokes, count, error } = await supabase
    .from("jokes")
    .select("id, setup, punchline, category, created_at", { count: "exact" })
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1)
    .returns<Joke[]>();

  // PostgREST rejects a range past the last row; send those visitors back to page 1.
  if (error?.code === "PGRST103") redirect("/jokes");

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          ← Home
        </Link>
        <p className={styles.eyebrow}>Humor Project · Assignment 2</p>
        <h1 className={styles.title}>Jokes from Supabase</h1>
        {jokes && jokes.length > 0 && (
          <p className={styles.count}>
            Showing {from + 1}–{from + jokes.length} of {total} rows from the <code>jokes</code> table
          </p>
        )}
      </header>

      {error ? (
        <p className={styles.message}>Couldn&apos;t load jokes: {error.message}</p>
      ) : jokes.length === 0 ? (
        <p className={styles.message}>The jokes table is empty.</p>
      ) : (
        <>
          <ol className={styles.list}>
            {jokes.map((joke) => (
              <li key={joke.id} className={styles.card}>
                <div className={styles.meta}>
                  <span>#{joke.id}</span>
                  {joke.category && <span className={styles.tag}>{joke.category}</span>}
                </div>
                <p className={styles.setup}>{joke.setup}</p>
                <p className={styles.punchline}>{joke.punchline}</p>
              </li>
            ))}
          </ol>

          {totalPages > 1 && (
            <nav className={styles.pagination} aria-label="Jokes pages">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className={styles.pageStep} rel="prev">
                  ← Prev
                </Link>
              ) : (
                <span className={styles.pageStep} aria-disabled="true">
                  ← Prev
                </span>
              )}

              <ol className={styles.pageNumbers}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <li key={n}>
                    <Link
                      href={pageHref(n)}
                      className={styles.pageNumber}
                      aria-current={n === page ? "page" : undefined}
                      aria-label={`Page ${n}`}
                    >
                      {n}
                    </Link>
                  </li>
                ))}
              </ol>

              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className={styles.pageStep} rel="next">
                  Next →
                </Link>
              ) : (
                <span className={styles.pageStep} aria-disabled="true">
                  Next →
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
