#[macro_export]
macro_rules! build_update_query {
    ($builder:expr, $has_fields:expr, $field:expr, $column:literal) => {
        if let Some(value) = &$field {
            if $has_fields {
                $builder.push(", ");
            }
            $builder.push(concat!($column, " = "));
            $builder.push_bind(value);
            $has_fields = true;
        }
    };
}