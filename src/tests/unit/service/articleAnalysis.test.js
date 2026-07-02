import test from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import fs from 'node:fs';

import pool from '../../../config/database.js';
import {
  buildAnalysisFilter,
  getArticleAnalysis,
  resolveAnalysisWindows,
} from '../../../services/articleAnalysis.service.js';

test.after(async () => {
  await pool.end();
});

test.afterEach(() => {
  mock.reset();
});

test('article analysis route is declared before the id catch-all route', () => {
  const routeSource = fs.readFileSync(new URL('../../../routes/article.route.js', import.meta.url), 'utf8');
  const analysisIndex = routeSource.indexOf("router.get('/analysis'");
  const idIndex = routeSource.indexOf("router.get('/:id'");

  assert.ok(analysisIndex >= 0, 'expected /analysis route to exist');
  assert.ok(idIndex >= 0, 'expected /:id route to exist');
  assert.ok(analysisIndex < idIndex, 'expected /analysis route before /:id');
});

test.describe('buildAnalysisFilter()', () => {
  test('threads institutionId into the shared article filter as exact-year EXISTS predicate', () => {
    const filter = buildAnalysisFilter({ institutionId: '7' });

    assert.ok(filter.whereSql.includes('"Institution_Author"'));
    assert.ok(filter.whereSql.includes('"year" = a."publication_year"'));
    assert.ok(!filter.whereSql.includes('last_known_institution'));
    assert.ok(filter.values.includes(7));
  });

  test('rejects invalid institutionId with INVALID_ENTITY_ID', () => {
    assert.throws(() => buildAnalysisFilter({ institutionId: '0' }), {
      code: 'INVALID_ENTITY_ID',
      statusCode: 400,
    });
  });
});

test.describe('resolveAnalysisWindows()', () => {
  test('uses explicit current window and derives equal-length comparison window', async () => {
    const window = await resolveAnalysisWindows({ fromYear: '2022', toYear: '2024' });

    assert.deepStrictEqual(window, {
      current: { from_year: 2022, to_year: 2024 },
      comparison: { from_year: 2019, to_year: 2021 },
      years: [2019, 2020, 2021, 2022, 2023, 2024],
      mode: 'explicit',
    });
  });

  test('maps publication_year to a single-year current window when explicit window is absent', async () => {
    const window = await resolveAnalysisWindows({ publicationYear: '2023' });

    assert.deepStrictEqual(window.current, { from_year: 2023, to_year: 2023 });
    assert.deepStrictEqual(window.comparison, { from_year: 2022, to_year: 2022 });
    assert.strictEqual(window.mode, 'publication_year');
  });

  test('rejects partial and reversed explicit windows', async () => {
    await assert.rejects(
      () => resolveAnalysisWindows({ fromYear: '2022' }),
      { code: 'INVALID_ANALYSIS_WINDOW', statusCode: 400 },
    );
    await assert.rejects(
      () => resolveAnalysisWindows({ fromYear: '2024', toYear: '2022' }),
      { code: 'INVALID_ANALYSIS_WINDOW', statusCode: 400 },
    );
  });

  test('rejects unsafe or out-of-range analysis windows before building year arrays', async () => {
    const maxYear = new Date().getFullYear() + 1;

    await assert.rejects(
      () => resolveAnalysisWindows({ fromYear: '1799', toYear: '1800' }),
      { code: 'INVALID_ANALYSIS_WINDOW', statusCode: 400 },
    );
    await assert.rejects(
      () => resolveAnalysisWindows({ fromYear: '2020', toYear: String(maxYear + 1) }),
      { code: 'INVALID_ANALYSIS_WINDOW', statusCode: 400 },
    );
    await assert.rejects(
      () => resolveAnalysisWindows({ fromYear: '2000', toYear: '2025' }),
      { code: 'INVALID_ANALYSIS_WINDOW', statusCode: 400 },
    );
    await assert.rejects(
      () => resolveAnalysisWindows({ publicationYear: '2024.5' }),
      { code: 'INVALID_ANALYSIS_WINDOW', statusCode: 400 },
    );
    await assert.rejects(
      () => resolveAnalysisWindows({ publicationYear: '-1' }),
      { code: 'INVALID_ANALYSIS_WINDOW', statusCode: 400 },
    );
  });

  test('defaults to latest two years in the filtered cohort', async () => {
    const calls = [];
    mock.method(pool, 'query', async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ to_year: 2025 }] };
    });

    const window = await resolveAnalysisWindows({ search: 'AI', scope: 'vn_universities' });

    assert.deepStrictEqual(window.current, { from_year: 2024, to_year: 2025 });
    assert.deepStrictEqual(window.comparison, { from_year: 2022, to_year: 2023 });
    assert.strictEqual(window.mode, 'default_latest');
    assert.ok(calls[0].sql.includes('MAX(a."publication_year")::integer AS "to_year"'));
    assert.ok(calls[0].sql.includes('a."is_vn_journal" IS TRUE'));
    assert.deepStrictEqual(calls[0].params, ['%AI%']);
  });
});

test.describe('getArticleAnalysis()', () => {
  test('returns summary, time series, entity rankings and honest trending articles contract', async () => {
    const calls = [];
    const rowsByCall = [
      [{ to_year: 2024 }],
      [{
        scholarly_works: 2,
        total_citations: 12,
        total_references: 18,
        available_citing_works: 3,
        available_references: 4,
        authors: 2,
        institutions: 1,
        journals: 1,
        open_access_works: 1,
        closed_access_works: 0,
        oa_unavailable_works: 1,
      }],
      [{ year: 2023, count: 1 }, { year: 2024, count: 1 }],
      [{
        year: 2024,
        citations: 5,
        coverage_articles: 1,
        total_articles_with_history: 1,
      }],
      [{ entity_id: '10', display_name: 'VN University', current_count: 2, previous_count: 1, absolute_growth: 1, growth_rate: 1 }],
      [],
      [],
      [],
      [],
      [{ entity_id: '20', display_name: 'Growth University', current_count: 1, previous_count: 0, absolute_growth: 1, growth_rate: null }],
      [],
      [],
      [],
      [],
      [{
        article_id: '99',
        title: 'Citation History Paper',
        publication_year: 2024,
        journal_id: '5',
        journal_name: 'Journal',
        citation_count: 8,
        reference_count: 10,
        current_citations: 5,
        previous_citations: 2,
        absolute_growth: 3,
        growth_rate: 1.5,
      }],
      [{ eligible_articles: 1, total_articles: 2 }],
    ];
    let callIndex = 0;

    mock.method(pool, 'query', async (sql, params) => {
      calls.push({ sql, params });
      return { rows: rowsByCall[callIndex++] };
    });

    const result = await getArticleAnalysis({ scope: 'vn_universities', limit: 5 });

    assert.deepStrictEqual(result.window.current, { from_year: 2023, to_year: 2024 });
    assert.deepStrictEqual(result.summary, rowsByCall[1][0]);
    assert.deepStrictEqual(result.works_over_time, [
      { year: 2021, count: 0 },
      { year: 2022, count: 0 },
      { year: 2023, count: 1 },
      { year: 2024, count: 1 },
    ]);
    assert.strictEqual(result.citations_over_time[3].citations, 5);
    assert.strictEqual(result.top.institutions[0].entity_id, '10');
    assert.strictEqual(result.growth.institutions[0].absolute_growth, 1);
    assert.strictEqual(result.trending_articles[0].current_citations, 5);
    assert.deepStrictEqual(result.trending_article_coverage, {
      eligible_articles: 1,
      total_articles: 2,
    });
    assert.strictEqual(calls[1].params.length, 4, 'summary query should receive a fully typed analysis window');
    assert.strictEqual(calls[2].params.length, 4, 'works query should receive a fully typed analysis window');
    assert.strictEqual(calls[3].params.length, 4, 'citations query should receive a fully typed analysis window');
    assert.strictEqual(calls.at(-1).params.length, 4, 'coverage query should receive a fully typed analysis window');
    assert.ok(calls.some(call => call.sql.includes('jsonb_each_text(a."citations_by_year"')));
    assert.ok(calls.some(call => call.sql.includes('ia."year" = fa."publication_year"')));
    assert.ok(calls.every(call => !call.sql.includes('last_known_institution')));
  });

  test('uses pre-aggregated summary SQL that cannot fan out article metrics', async () => {
    const calls = [];
    const rowsByCall = [
      [{
        scholarly_works: 2,
        total_citations: 12,
        total_references: 18,
        available_citing_works: 3,
        available_references: 4,
        authors: 2,
        institutions: 1,
        journals: 1,
        open_access_works: 1,
        closed_access_works: 0,
        oa_unavailable_works: 1,
      }],
      [],
      [],
      [], [], [], [], [], [], [], [], [], [],
    ];
    let callIndex = 0;

    mock.method(pool, 'query', async (sql, params) => {
      calls.push({ sql, params });
      return { rows: rowsByCall[callIndex++] || [] };
    });

    await getArticleAnalysis({ fromYear: '2023', toYear: '2024', scope: 'vn_universities' });

    const summarySql = calls[0].sql;
    assert.ok(summarySql.includes('article_totals AS'), 'summary should aggregate Article metrics before relation joins');
    assert.ok(summarySql.includes('citing_work_rows AS'), 'summary should dedupe citing work relation rows in its own CTE');
    assert.ok(summarySql.includes('reference_rows AS'), 'summary should dedupe reference relation rows in its own CTE');
    assert.ok(summarySql.includes('valid_author_rows AS'), 'summary should count filtered authors through Author');
    assert.ok(summarySql.includes('institution_rows AS'), 'summary should count institutions through valid authors');
    assert.ok(!summarySql.includes('LEFT JOIN "Article_Citing_Work"'), 'summary must not join citing works into article totals');
    assert.ok(!summarySql.includes('LEFT JOIN "Article_Reference"'), 'summary must not join references into article totals');
    assert.ok(!summarySql.includes('LEFT JOIN "Author_Article"'), 'summary must not join authors into article totals');
    assert.ok(!summarySql.includes('COUNT(DISTINCT aa."author_id")'), 'summary must not count soft-deleted authors from Author_Article');
    assert.ok(summarySql.includes('COUNT(*)::integer AS "available_citing_works"'));
    assert.ok(summarySql.includes('COUNT(*)::integer AS "available_references"'));
    assert.ok(summarySql.includes('UPPER(TRIM(inst."country_code")) = \'VN\''));
  });

  test('returns independently ranked top and growth entity arrays', async () => {
    const calls = [];
    const rowsByCall = [
      [emptySummaryRow()],
      [],
      [],
      [
        { entity_id: 'top', display_name: 'Top Entity', current_count: 10, previous_count: 9, absolute_growth: 1, growth_rate: 0.1111 },
      ],
      [], [], [], [],
      [
        { entity_id: 'growth', display_name: 'Growth Entity', current_count: 8, previous_count: 1, absolute_growth: 7, growth_rate: 7 },
      ],
      [], [], [], [],
      [],
      [{ eligible_articles: 0, total_articles: 0 }],
    ];
    let callIndex = 0;

    mock.method(pool, 'query', async (sql) => {
      calls.push(sql);
      return { rows: rowsByCall[callIndex++] || [] };
    });

    const result = await getArticleAnalysis({ fromYear: '2023', toYear: '2024' });

    assert.notStrictEqual(result.top.institutions, result.growth.institutions);
    assert.strictEqual(result.top.institutions[0].entity_id, 'top');
    assert.strictEqual(result.growth.institutions[0].entity_id, 'growth');
    assert.ok(calls[3].includes('ORDER BY "current_count" DESC, "absolute_growth" DESC, "display_name" ASC'));
    assert.ok(calls[8].includes('ORDER BY "absolute_growth" DESC, "current_count" DESC, "display_name" ASC'));
  });

  test('keeps citation coverage denominator stable for zero-filled years', async () => {
    const rowsByCall = [
      [emptySummaryRow()],
      [],
      [{ year: 2024, citations: 5, coverage_articles: 1, total_articles_with_history: 2 }],
      [], [], [], [], [], [], [], [], [], [],
      [],
      [{ eligible_articles: 0, total_articles: 0 }],
    ];
    let callIndex = 0;

    mock.method(pool, 'query', async () => ({ rows: rowsByCall[callIndex++] || [] }));

    const result = await getArticleAnalysis({ fromYear: '2023', toYear: '2024' });

    assert.deepStrictEqual(
      result.citations_over_time.map((row) => row.total_articles_with_history),
      [2, 2, 2, 2],
    );
    assert.strictEqual(result.citations_over_time.find((row) => row.year === 2023).citations, 0);
  });

  test('uses the trending eligible cohort for coverage instead of current publication year only', async () => {
    const calls = [];
    const rowsByCall = [
      [emptySummaryRow()],
      [],
      [],
      [], [], [], [], [], [], [], [], [], [],
      [],
      [{ eligible_articles: 1, total_articles: 2 }],
    ];
    let callIndex = 0;

    mock.method(pool, 'query', async (sql, params) => {
      calls.push({ sql, params });
      return { rows: rowsByCall[callIndex++] || [] };
    });

    await getArticleAnalysis({ fromYear: '2023', toYear: '2024' });

    const coverageSql = calls.at(-1).sql;
    assert.ok(coverageSql.includes('eligible_articles AS'), 'coverage should share a named eligible cohort with trending articles');
    assert.ok(coverageSql.includes('jsonb_each_text'), 'coverage should validate history keys/values like trending articles');
    assert.ok(!coverageSql.includes('WHERE fa."publication_year" BETWEEN'), 'coverage must not add a current publication-year filter absent from trending');
  });
});

const emptySummaryRow = () => ({
  scholarly_works: 0,
  total_citations: 0,
  total_references: 0,
  available_citing_works: 0,
  available_references: 0,
  authors: 0,
  institutions: 0,
  journals: 0,
  open_access_works: 0,
  closed_access_works: 0,
  oa_unavailable_works: 0,
});
