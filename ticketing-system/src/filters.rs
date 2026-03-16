use std::net::IpAddr;
use anyhow::anyhow;
use serde::Deserialize;
use sqlx::{QueryBuilder, Postgres, types::ipnetwork::IpNetwork};

use crate::build_where_condition;

#[derive(Debug, Deserialize)]
#[serde(try_from = "String")]
pub enum IpFilter {
    Exact(IpAddr),
    Cidr(IpNetwork),
    Range(IpAddr, IpAddr),
}

impl TryFrom<String> for IpFilter {
    type Error = anyhow::Error;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(value)
    }
}

impl IpFilter {
    pub fn parse(s: String) -> Result<Self, anyhow::Error> {
        let s = s.trim();

        if s.contains('/') {
            let net: IpNetwork = s.parse()
                .map_err(|_| anyhow!("Invalid CIDR: {s}"))?;
            return Ok(IpFilter::Cidr(net));
        }

        if let Some((start, end)) = s.split_once('-') {
            let start: IpAddr = start.trim().parse()
                .map_err(|_| anyhow!("Invalid range start: {start}"))?;
            let end: IpAddr = end.trim().parse()
                .map_err(|_| anyhow!("Invalid range end: {end}"))?;
            return Ok(IpFilter::Range(start, end));
        }

        let addr: IpAddr = s.parse()
            .map_err(|_| anyhow!("Invalid IP: {s}"))?;
        Ok(IpFilter::Exact(addr))
    }

    pub fn apply_to_query<'a>(
        &self,
        builder: &mut QueryBuilder<'a, Postgres>,
        has_filters: &mut bool,
    ) {
        build_where_condition!(@add_where_and builder, *has_filters);

        match self {
            IpFilter::Exact(addr) => {
                builder.push("ip = ")
                    .push_bind(*addr);
            }
            IpFilter::Cidr(net) => {
                builder.push("ip <<= ")
                    .push_bind(*net);
            }
            IpFilter::Range(start, end) => {
                builder.push("ip BETWEEN ")
                    .push_bind(*start)
                    .push(" AND ")
                    .push_bind(*end);
            }
        }
    }
}
