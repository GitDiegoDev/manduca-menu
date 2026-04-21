import os
import subprocess
import time
import json
import re
from playwright.sync_api import sync_playwright

def run_test(page):
    # Mock the API
    def handle_route(route):
        response_data = {
            "site": {"name": "Manducá", "is_open": True},
            "categories": [
                {
                    "id": 2, "name": "Bebidas", "products": [
                        {"id": 201, "name": "Capuchino", "price_retail": "1500", "stock": 10, "active": 1, "show_in_menu": 1},
                        {"id": 202, "name": "Chocolatada", "price_retail": "1200", "stock": 10, "active": 1, "show_in_menu": 1},
                        {"id": 203, "name": "Mate Cocido", "price_retail": "800", "stock": 10, "active": 1, "show_in_menu": 1},
                        {"id": 204, "name": "Coca Cola", "price_retail": "1000", "stock": 10, "active": 1, "show_in_menu": 1},
                        {"id": 205, "name": "Agua", "price_retail": "800", "stock": 10, "active": 1, "show_in_menu": 1},
                        {"id": 206, "name": "Cerveza IPA", "price_retail": "2500", "stock": 10, "active": 1, "show_in_menu": 1},
                        {"id": 207, "name": "Jugo de Naranja", "price_retail": "1800", "stock": 10, "active": 1, "show_in_menu": 1},
                        {"id": 208, "name": "Algo Raro", "price_retail": "5000", "stock": 10, "active": 1, "show_in_menu": 1},
                    ]
                },
                {
                    "id": 3, "name": "Combos", "products": [
                        {"id": 301, "name": "Combo Merienda", "price_retail": "3000", "stock": 10, "active": 1, "show_in_menu": 1}
                    ]
                }
            ],
            "daily_dishes": []
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

    # Check for Combo icon
    combo_btn = page.locator('button[data-category="3"]')
    combo_icon = combo_btn.locator('.category-icon').inner_text()
    print(f"Combo category icon: {combo_icon}")
    if combo_icon == "🍱":
        print("SUCCESS: Combo icon is 🍱")
    else:
        print(f"FAILURE: Expected 🍱, got {combo_icon}")

    # Click Bebidas category
    page.locator('button[data-category="2"]').click()
    page.wait_for_timeout(500)

    # Verify subcategory filters
    filters_raw = page.locator('.filtro-btn').all_text_contents()
    # Normalize filters: replace multiple whitespaces/newlines with a single space and trim
    filters = [" ".join(f.split()) for f in filters_raw]
    print("Filters found:", filters)

    expected_filters = ["🥤 Todos", "☕ Café", "🍵 Infusiones", "🥤 Jugos y Licuados", "🥤 Sin Alcohol", "🍺 Con Alcohol", "✨ Otros"]
    for f in expected_filters:
        if f in filters:
            print(f"SUCCESS: Filter '{f}' found.")
        else:
            print(f"FAILURE: Filter '{f}' NOT found.")

    def check_subcategory(sub_name, expected_products):
        print(f"Testing subcategory: {sub_name}")
        # Using a more flexible locator for the button
        page.locator(".filtro-btn", has_text=sub_name).click()
        page.wait_for_timeout(500)
        products = page.locator('.product-name').all_text_contents()
        print(f"Products in {sub_name}: {products}")
        if sorted(products) == sorted(expected_products):
            print(f"SUCCESS: {sub_name} products match.")
        else:
            print(f"FAILURE: {sub_name} expected {expected_products}, got {products}")

    check_subcategory("Café", ["Capuchino"])
    check_subcategory("Infusiones", ["Chocolatada", "Mate Cocido"])
    check_subcategory("Sin Alcohol", ["Coca Cola", "Agua"])
    check_subcategory("Otros", ["Algo Raro"])
    check_subcategory("Con Alcohol", ["Cerveza IPA"])
    check_subcategory("Jugos y Licuados", ["Jugo de Naranja"])

    # Capture final state screenshot
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    page.screenshot(path="/home/jules/verification/screenshots/categories_test.png")

if __name__ == "__main__":
    server = subprocess.Popen(["python3", "-m", "http.server", "8000"])
    time.sleep(2)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            run_test(page)
        finally:
            context.close()
            browser.close()
            server.terminate()
