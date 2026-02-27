use serde::{Serialize, Deserialize};
use sqlx::{types::{ipnetwork::IpNetwork, mac_address::MacAddress}};

pub type AssetId = i64;
pub type ModelId = i32;
pub type CategoryId = i16;
pub type StatusId = i16;

#[derive(Debug, Serialize, Deserialize)]
pub struct Asset {
    pub id: AssetId,
    pub model_id: ModelId,
    pub status: StatusId,
    pub name: String,
    pub description: Option<String>,
    pub serial_number: Option<String>,
    pub inventory_number: Option<String>,

    pub location: Option<String>,
    pub assigned_to: Option<String>,
    
    pub ip: Option<IpNetwork>,
    pub mac: Option<MacAddress>,
}

pub struct Model {
    pub id: ModelId,
    pub name: String,
    pub category: CategoryId,
}