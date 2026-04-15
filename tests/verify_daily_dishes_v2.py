import os
import subprocess
import time
import json
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Mock the API
    def handle_route(route):
        response_data = {
            "site": {"name": "Manducá", "is_open": True},
            "categories": [
                {
                    "id": 1, "name": "Desayunos", "products": [
                        {"id": 100, "name": "Huevo revuelto", "price_retail": "1000", "stock": 10, "active": 1, "show_in_menu": 1}
                    ]
                }
            ],
            "daily_dishes": [
                {
                    "id": 7, "name": "Matambre", "description": "Desc", "price": "7000", "stock": 10, "active": True, "show_in_menu": True}
            ]
        }
        route.fulfill(
            status=200,
            headers={"Access-Control-Allow-Origin": "*"},
            content_type="application/json",
            body=json.dumps(response_data)
        )

    page.route("**/api/menu", handle_route)

    page.goto("http://localhost:8000")
    page.wait_for_timeout(2000)

    # Check for products
    products = page.locator('.product-name').all_text_contents()
    print("Products found (All):", products)

    # Check if 'Matambre' is at the beginning (new behavior)
    if products[0] == "Matambre":
        print("SUCCESS: Matambre is at the beginning.")
    else:
        print(f"FAILURE: Matambre is at position {products.index('Matambre') if 'Matambre' in products else 'Not found'}")

    # Check categories
    categories = page.locator('.category-btn').all_text_contents()
    print("Categories found:", [c.strip() for c in categories])

    if any("Platos del día" in c for c in categories):
        print("SUCCESS: 'Platos del día' category found.")
    else:
        print("FAILURE: 'Platos del día' category NOT found.")

    # Click 'Platos del día' category
    page.get_by_role("button", name="Platos del día").click()
    page.wait_for_timeout(500)

    products_daily = page.locator('.product-name').all_text_contents()
    print("Products in Platos del día:", products_daily)

    if products_daily == ["Matambre"]:
        print("SUCCESS: Only Matambre shown in daily category.")
    else:
        print(f"FAILURE: Expected ['Matambre'], got {products_daily}")

    # Capture final state screenshot
    page.screenshot(path="/home/jules/verification/screenshots/final_fix.png")

if __name__ == "__main__":
    server = subprocess.Popen(["python3", "-m", "http.server", "8000"])
    time.sleep(2)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
            server.terminate()
