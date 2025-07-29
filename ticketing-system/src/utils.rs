#[macro_export]
macro_rules! build_update_query {
    ($builder:expr, $has_fields:expr, $field:expr, $column:literal) => {
        if let Some(value) = &$field {
            if $has_fields {
                $builder.push(", ");
            }
            $builder.push(concat!($column, " = ")).push_bind(value);
            $has_fields = true;
        }
    };
}

#[macro_export]
macro_rules! build_where_condition {
    ($builder:expr, $has_filters:expr, $field:expr, $column:literal, $operator:literal) => {
        if let Some(value) = &$field {
            build_where_condition!(@add_where_and $builder, $has_filters);
            $builder.push(concat!($column, " ", $operator, " ")).push_bind(value);
        }
    };
    
    ($builder:expr, $has_filters:expr, $field:expr, $column:literal, in) => {
        if let Some(values) = &$field {
            build_where_condition!(@add_where_and $builder, $has_filters);

            $builder.push(concat!($column, " IN ("));
            let mut separated = $builder.separated(", ");
            for value in values.iter() {
                separated.push_bind(value);
            }
            separated.push_unseparated(")");
        }
    };

    (@add_where_and $builder:expr, $has_filters:expr) => {
        if !$has_filters {
            $builder.push("WHERE ");
            $has_filters = true;
        } else {
            $builder.push(" AND ");
        }
    };
}