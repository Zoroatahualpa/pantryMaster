import express from 'express';
import cors from 'cors';
import { JSONFilePreset } from 'lowdb/node';
import { createServer as createViteServer } from 'vite';
import path from 'path';

interface Product {
  id: string;
  nombre: string;
  marca_referencial: string;
  cantidad_actual: number;
  cantidad_minima_alerta: number;
  unidad: string;
  categoria: string;
}

interface RecipeIngredient {
  nombre: string;
  cantidad: number;
}

interface Recipe {
  id: string;
  nombre: string;
  ingredientes: RecipeIngredient[];
}

interface Data {
  inventory: Product[];
  recipes: Recipe[];
}

const defaultData: Data = { inventory: [], recipes: [] };

async function startServer() {
  const app = express();
  const PORT = 3000;

  const db = await JSONFilePreset<Data>('/db.json', defaultData);

  app.use(cors());
  app.use(express.json());

  // GET all inventory
  app.get('/api/inventory', (req, res) => {
    res.json(db.data.inventory);
  });

  // GET shopping list (items at or below minimum threshold)
  app.get('/api/shopping-list', (req, res) => {
    const list = db.data.inventory.filter(
      item => item.cantidad_actual <= item.cantidad_minima_alerta
    );
    res.json(list);
  });

  // POST register purchase (bulk stock update)
  app.post('/api/purchase', async (req, res) => {
    const itemsPurchased: { id: string; cantidad: number }[] = req.body.items;

    if (!itemsPurchased || !Array.isArray(itemsPurchased)) {
      return res.status(400).json({ error: 'Lista de items inválida' });
    }

    db.data.inventory.forEach(product => {
      const purchase = itemsPurchased.find(item => item.id === product.id);
      if (purchase) {
        product.cantidad_actual += purchase.cantidad;
      }
    });

    await db.write();
    res.json({ message: 'Stock actualizado con éxito', inventory: db.data.inventory });
  });

  // POST add new product
  app.post('/api/inventory/add', async (req, res) => {
    const { nombre, marca_referencial, cantidad_actual, cantidad_minima_alerta, unidad, categoria } = req.body;

    if (!nombre || !categoria) {
      return res.status(400).json({ error: 'Nombre y Categoría son requeridos' });
    }

    const newProduct: Product = {
      id: Date.now().toString(),
      nombre,
      marca_referencial: marca_referencial || 'Genérico',
      cantidad_actual: Number(cantidad_actual) || 0,
      cantidad_minima_alerta: Number(cantidad_minima_alerta) || 1,
      unidad: unidad || 'unidades',
      categoria,
    };

    db.data.inventory.push(newProduct);
    await db.write();
    res.json(newProduct);
  });

  // PUT update a product's full details
  app.put('/api/inventory/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const product = db.data.inventory.find(p => p.id === id);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    Object.assign(product, updates);
    await db.write();
    res.json(product);
  });

  // PATCH update only the stock quantity of a single item
  app.post('/api/inventory/update', async (req, res) => {
    const { id, cantidad_actual } = req.body;
    const product = db.data.inventory.find(p => p.id === id);
    if (product) {
      product.cantidad_actual = Number(cantidad_actual);
      await db.write();
      res.json(product);
    } else {
      res.status(404).json({ error: 'Producto no encontrado' });
    }
  });

  // DELETE a product
  app.delete('/api/inventory/:id', async (req, res) => {
    const { id } = req.params;
    const idx = db.data.inventory.findIndex(p => p.id === id);

    if (idx === -1) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    db.data.inventory.splice(idx, 1);
    await db.write();
    res.json({ message: 'Producto eliminado', id });
  });

  // GET suggested recipes (all ingredients available)
  app.get('/api/recipes/suggested', (req, res) => {
    const availableRecipes = db.data.recipes.filter(recipe => {
      return recipe.ingredientes.every(ing => {
        const item = db.data.inventory.find(p => p.nombre === ing.nombre);
        return item && item.cantidad_actual >= ing.cantidad;
      });
    });
    res.json(availableRecipes);
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PantryMaster Server running on http://localhost:${PORT}`);
  });
}

startServer();
