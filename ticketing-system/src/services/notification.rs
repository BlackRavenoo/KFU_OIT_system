use crate::schema::{common::UserId, notification::Notification, tickets::TicketId};

pub struct NotificationService {
    // TODO: sse notifications
}

impl NotificationService {
    #[tracing::instrument(
        name = "Insert notifications and notify users",
        skip(self, executor)
    )]
    pub async fn notify<'a, E>(
        &self,
        executor: E,
        ticket_id: TicketId,
        user_ids: &[UserId],
        notification: Notification
    ) -> Result<(), sqlx::Error>
    where
        E: sqlx::Executor<'a, Database = sqlx::Postgres>,
    {
        let mut builder = sqlx::QueryBuilder::new("INSERT INTO notifications(ticket_id, user_id, payload) ");
        
        builder.push_values(user_ids, |mut b, user_id| {
            b.push_bind(ticket_id)
                .push_bind(user_id)
                .push_bind(sqlx::types::Json(&notification));
        });

        builder.push(
            " ON CONFLICT (user_id, ticket_id) WHERE NOT read AND payload->>'type' = 'new_messages'
            DO UPDATE SET payload = jsonb_set(
                notifications.payload,
                '{data, count}',
                to_jsonb((notifications.payload->'data'->>'count')::int + (EXCLUDED.payload->'data'->>'count')::int)
            )"
        );

        println!("{}", builder.sql());

        builder.build()
            .execute(executor)
            .await?;
        
        Ok(())
    }
}