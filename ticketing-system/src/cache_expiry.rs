use std::time::{Duration, Instant};

use moka::Expiry;

pub struct CacheExpiry(pub Duration);

impl<K, V> Expiry<K, V> for CacheExpiry {
    fn expire_after_create(
        &self,
        _key: &K,
        _value: &V,
        _current_time: Instant,
    ) -> Option<Duration> {
        Some(self.0)
    }
}