import { test, expect } from '@playwright/test';

test('configuration-only album addition opens a single-photo viewer',async({page})=>{
  await page.goto('./');
  await page.getByRole('link',{name:'查看相册：配置新增的单张相册'}).click();
  await expect(page.getByRole('heading',{name:'配置新增的单张相册'})).toBeVisible();
  await page.getByTestId('album-media-grid').getByRole('button',{name:/查看照片/}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('img')).toBeVisible();
  await expect(dialog).toContainText('1 / 1');
  await expect(dialog.getByRole('button',{name:'上一项'})).toBeDisabled();
  await expect(dialog.getByRole('button',{name:'下一项'})).toBeDisabled();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft');
  await expect(dialog).toContainText('1 / 1');
  await page.getByRole('button',{name:'关闭查看器'}).click();
  await page.reload();
  await expect(page.getByRole('heading',{name:'配置新增的单张相册'})).toBeVisible();
});
