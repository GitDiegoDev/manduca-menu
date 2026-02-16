const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Mock the API response
  await page.route('**/api/menu', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        categories: [
          { id: 1, nombre: 'Bebidas' }
        ],
        products: [
          { id: 1, nombre: 'Café con leche', category_id: 1, precio: 500, descripcion: 'Café con leche' },
          { id: 2, nombre: 'Té verde', category_id: 1, precio: 400, descripcion: 'Té verde' },
          { id: 3, nombre: 'Jugo de naranja', category_id: 1, precio: 600, descripcion: 'Jugo de naranja' },
          { id: 4, nombre: 'Agua mineral', category_id: 1, precio: 300, descripcion: 'Agua mineral' }
        ],
        daily_dishes: []
      })
    });
  });

  const filePath = 'file://' + path.resolve('index.html');
  await page.goto(filePath);
  await page.waitForSelector('.category-btn');

  // Click on Bebidas category
  await page.click('.category-btn:has-text("Bebidas")');
  await page.waitForSelector('.filtros-bebidas');

  await page.screenshot({ path: 'bebidas_all.png' });

  // Click on Café filter
  await page.click('.filtro-btn:has-text("Café")');
  await page.waitForTimeout(500); // Wait for filter
  await page.screenshot({ path: 'bebidas_cafe_filtered.png' });

  await browser.close();
})();
