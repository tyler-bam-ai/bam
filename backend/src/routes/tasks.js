const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// In-memory task store (replace with database)
const tasks = new Map();

// Seed some demo tasks
const demoTasks = [
    {
        id: uuidv4(),
        companyId: 'demo-company-1',
        assignedTo: 'consumer-1',
        title: 'Process morning email queue',
        description: 'Review and respond to all customer emails from overnight',
        priority: 'high',
        dueTime: '09:00',
        completed: false,
        recurring: true,
        recurringPattern: 'daily',
        createdAt: new Date().toISOString()
    },
    {
        id: uuidv4(),
        companyId: 'demo-company-1',
        assignedTo: 'consumer-1',
        title: 'Update inventory spreadsheet',
        description: 'Sync inventory counts from the warehouse system',
        priority: 'medium',
        dueTime: '12:00',
        completed: false,
        recurring: true,
        recurringPattern: 'daily',
        createdAt: new Date().toISOString()
    },
    {
        id: uuidv4(),
        companyId: 'demo-company-1',
        assignedTo: 'consumer-1',
        title: 'Review pending customer requests',
        description: 'Check and process any pending support tickets',
        priority: 'high',
        dueTime: '14:00',
        completed: true,
        recurring: true,
        recurringPattern: 'daily',
        createdAt: new Date().toISOString()
    },
    {
        id: uuidv4(),
        companyId: 'demo-company-1',
        assignedTo: 'consumer-1',
        title: 'Send weekly report to clients',
        description: 'Compile and email the weekly activity report',
        priority: 'high',
        dueTime: '15:00',
        completed: false,
        recurring: true,
        recurringPattern: 'weekly',
        createdAt: new Date().toISOString()
    },
    {
        id: uuidv4(),
        companyId: 'demo-company-1',
        assignedTo: 'consumer-1',
        title: 'Backup daily transaction logs',
        description: 'Export and archive the day\'s transaction history',
        priority: 'low',
        dueTime: '17:00',
        completed: false,
        recurring: true,
        recurringPattern: 'daily',
        createdAt: new Date().toISOString()
    }
];

demoTasks.forEach(task => tasks.set(task.id, task));

// Get tasks for today
router.get('/today', authMiddleware, (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    const userTasks = Array.from(tasks.values())
        .filter(t => t.companyId === req.user.companyId)
        .map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            dueTime: t.dueTime,
            completed: t.completed,
            recurring: t.recurring
        }))
        .sort((a, b) => {
            // Sort by time
            const timeA = a.dueTime.replace(':', '');
            const timeB = b.dueTime.replace(':', '');
            return parseInt(timeA) - parseInt(timeB);
        });

    res.json(userTasks);
});

// Get all tasks
router.get('/', authMiddleware, (req, res) => {
    const userTasks = Array.from(tasks.values())
        .filter(t => t.companyId === req.user.companyId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(userTasks);
});

// Create task
router.post('/', authMiddleware, (req, res) => {
    try {
        const { title, description, priority, dueTime, assignedTo, recurring, recurringPattern } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Task title is required' });
        }

        const task = {
            id: uuidv4(),
            companyId: req.user.companyId,
            createdBy: req.user.id,
            assignedTo: assignedTo || req.user.id,
            title,
            description: description || '',
            priority: priority || 'medium',
            dueTime: dueTime || null,
            completed: false,
            recurring: recurring || false,
            recurringPattern: recurringPattern || null,
            createdAt: new Date().toISOString()
        };

        tasks.set(task.id, task);

        res.status(201).json(task);
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// Update task
router.put('/:id', authMiddleware, (req, res) => {
    const task = tasks.get(req.params.id);

    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    if (task.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const updates = req.body;
    const allowedUpdates = ['title', 'description', 'priority', 'dueTime', 'completed', 'assignedTo'];

    Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
            task[key] = updates[key];
        }
    });

    task.updatedAt = new Date().toISOString();
    tasks.set(task.id, task);

    res.json(task);
});

// Toggle task completion
router.patch('/:id/toggle', authMiddleware, (req, res) => {
    const task = tasks.get(req.params.id);

    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    if (task.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
    }

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    task.completedBy = task.completed ? req.user.id : null;
    tasks.set(task.id, task);

    res.json(task);
});

// Delete task
router.delete('/:id', authMiddleware, (req, res) => {
    const task = tasks.get(req.params.id);

    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    if (task.companyId !== req.user.companyId) {
        return res.status(403).json({ error: 'Access denied' });
    }

    tasks.delete(req.params.id);

    res.json({ success: true, message: 'Task deleted' });
});

// Get task stats
router.get('/stats', authMiddleware, (req, res) => {
    const companyTasks = Array.from(tasks.values())
        .filter(t => t.companyId === req.user.companyId);

    const stats = {
        total: companyTasks.length,
        completed: companyTasks.filter(t => t.completed).length,
        pending: companyTasks.filter(t => !t.completed).length,
        highPriority: companyTasks.filter(t => t.priority === 'high' && !t.completed).length,
        completionRate: companyTasks.length > 0
            ? Math.round((companyTasks.filter(t => t.completed).length / companyTasks.length) * 100)
            : 0
    };

    res.json(stats);
});

module.exports = router;
