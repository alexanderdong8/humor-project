import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JokeCard } from "@/components/joke-card";
import { getJokeCategoryCounts, JOKE_COLUMNS, type Joke } from "@/lib/jokes";
import { createClient } from "@/lib/supabase/server";
import styles from "./jokes.module.css";

export const metadata: Metadata = {
  title: "The Library",
  description: "Browse every joke by category. Read the setup, then tap for the punchline.",
};

const PAGE_SIZE = 9;

function libraryHref(category: string | null, page = 1) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/jokes?${query}` : "/jokes";
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function JokesPage(props: PageProps<"/jokes">) {
  const searchParams = await props.searchParams;
  const requested = Number(first(searchParams.page));
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
  const from = (page - 1) * PAGE_SIZE;

  const categories = await getJokeCategoryCounts();
  const categoryParam = first(searchParams.category) ?? null;
  const category = categories.find((c) => c.category === categoryParam)?.category ?? null;
  // Unknown categories fall back to the full library instead of an empty page.
  if (categoryParam && !category) redirect("/jokes");

  const supabase = await createClient();
  let query = supabase.from("jokes").select(JOKE_COLUMNS, { count: "exact" });
  if (category) query = query.eq("category", category);
  const { data: jokes, count, error } = await query
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1)
    .returns<Joke[]>();

  // PostgREST rejects a range past the last row; send those visitors to page 1.
  if (error?.code === "PGRST103") redirect(libraryHref(category));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allCount = categories.reduce((sum, c) => sum + c.joke_count, 0);

  return (
    <main id="main" className={styles.main}>
      <header className={styles.header}>
        <p className={styles.kicker}>The Library</p>
        <h1 className={styles.title}>{category ? <>{category} jokes</> : <>Every joke we&apos;ve got.</>}</h1>
        <p className={styles.lede}>Read the setup, take a beat, then tap the card for the punchline.</p>
      </header>

      {categories.length > 0 && (
        <nav className={styles.filters} aria-label="Filter by category">
          <Link href="/jokes" className={styles.chip} aria-current={category ? undefined : "page"}>
            All <span>{allCount}</span>
          </Link>
          {categories.map((c) => (
            <Link
              key={c.category}
              href={libraryHref(c.category)}
              className={styles.chip}
              aria-current={c.category === category ? "page" : undefined}
            >
              {c.category} <span>{c.joke_count}</span>
            </Link>
          ))}
        </nav>
      )}

      {error ? (
        <div className={styles.empty} role="alert">
          <p className={styles.emptyTitle}>The mic cut out.</p>
          <p>We couldn&apos;t load jokes right now. Please refresh in a moment.</p>
        </div>
      ) : jokes.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Tough crowd.</p>
          <p>There are no jokes here yet.</p>
        </div>
      ) : (
        <>
          <p className={styles.count} aria-live="polite">
            Showing {from + 1}–{from + jokes.length} of {total}
          </p>
          <ul className={styles.grid}>
            {jokes.map((joke, i) => (
              <li key={joke.id}>
                <JokeCard joke={joke} index={i} />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav className={styles.pagination} aria-label="Pagination">
              {page > 1 ? (
                <Link href={libraryHref(category, page - 1)} className={styles.step} rel="prev">
                  ← Previous
                </Link>
              ) : (
                <span className={styles.step} aria-disabled="true">
                  ← Previous
                </span>
              )}

              <ol className={styles.pages}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <li key={n}>
                    <Link
                      href={libraryHref(category, n)}
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
                <Link href={libraryHref(category, page + 1)} className={styles.step} rel="next">
                  Next →
                </Link>
              ) : (
                <span className={styles.step} aria-disabled="true">
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
