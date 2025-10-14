#![cfg_attr(coverage_nightly, feature(coverage_attribute))]

pub mod config;
pub mod startup;
pub mod telemetry;
pub mod auth;
pub mod schema;
pub mod routes;
pub mod utils;
pub mod storage;
pub mod services;
pub mod image;
pub mod sqlx_macro;
pub mod domain;
pub mod email_client;
pub mod cache_expiry;