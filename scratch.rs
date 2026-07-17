use salvo::prelude::*;
fn test(res: &Response) {
    let _ = res.status_code;
}
