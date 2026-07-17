#![allow(dead_code)]
use anyhow::Result;
use calamine::Reader;

pub async fn read_excel(file_path: &str) -> Result<Vec<Vec<String>>> {
    let mut workbook = calamine::open_workbook_auto(file_path)?;
    let sheet_names = workbook.sheet_names().to_vec();

    let mut all_data = Vec::new();

    for sheet_name in sheet_names {
        if let Ok(range) = workbook.worksheet_range(&sheet_name) {
            for row in range.rows() {
                let row_data: Vec<String> = row.iter()
                    .map(|cell| match cell {
                        calamine::Data::String(s) => s.clone(),
                        calamine::Data::Float(f) => f.to_string(),
                        calamine::Data::Int(i) => i.to_string(),
                        calamine::Data::Bool(b) => b.to_string(),
                        calamine::Data::DateTime(d) => d.to_string(),
                        calamine::Data::Error(e) => format!("Error({:?})", e),
                        _ => String::new(),
                    })
                    .collect();
                all_data.push(row_data);
            }
        }
    }

    Ok(all_data)
}

pub async fn create_excel(data: Vec<Vec<String>>, output_path: &str) -> Result<()> {
    let mut workbook = rust_xlsxwriter::Workbook::new();
    let sheet = workbook.add_worksheet();

    for (row_idx, row) in data.iter().enumerate() {
        for (col_idx, cell_value) in row.iter().enumerate() {
            sheet.write_string(row_idx as u32, col_idx as u16, cell_value)?;
        }
    }

    workbook.save(output_path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_excel() {
        let data = vec![
            vec!["Name".to_string(), "Age".to_string()],
            vec!["Alice".to_string(), "30".to_string()],
        ];
        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(create_excel(data, "/tmp/test.xlsx"));
        assert!(result.is_ok());
        let _ = std::fs::remove_file("/tmp/test.xlsx");
    }
}
