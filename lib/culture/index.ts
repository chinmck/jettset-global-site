/* eslint-disable @typescript-eslint/no-explicit-any */
// Typed facade over the plain-JavaScript domain modules (they stay .mjs so Node's test runner and
// the Netlify function can load them directly).
import * as domain from "./domain.mjs";
import * as access from "./access.mjs";
import * as sync from "./sync.mjs";
import * as page from "./page.mjs";

export const cal: any = domain.cal;
export const CATEGORIES = domain.CATEGORIES as unknown as Array<[string, string]>;
export const COMPARE_FIELDS = domain.COMPARE_FIELDS as unknown as string[];
export const categoryLabel = domain.categoryLabel as (k: string) => string;
export const applyDecision = domain.applyDecision as (a: any) => any;
export const publicEvents = domain.publicEvents as (events: any[], today: string) => any[];
export const sitemapEvents = domain.sitemapEvents as (events: any[], today: string) => any[];
export const ReviewError = domain.ReviewError as new (code: string, message: string) => Error;
export const assertStaff = access.assertStaff as (user: any) => any;
export const runCultureSync = sync.runCultureSync as (a: any) => Promise<any>;
export const renderEventPage = page.renderEventPage as (e: any, o?: any) => string;
export const renderNotFound = page.renderNotFound as (status: number) => string;
export const renderSitemap = page.renderSitemap as (events: any[]) => string;
