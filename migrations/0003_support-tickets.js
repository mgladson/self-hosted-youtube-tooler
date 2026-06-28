/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.up = (pgm) => {
  pgm.createTable('support_tickets', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    customer_email: {
      type: 'varchar(255)',
      notNull: true,
    },
    customer_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    subject: {
      type: 'varchar(500)',
      notNull: true,
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: "'open'",
    },
    priority: {
      type: 'varchar(10)',
      notNull: true,
      default: "'medium'",
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('support_tickets', 'customer_email');
  pgm.createIndex('support_tickets', 'status');

  pgm.createTable('ticket_messages', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    ticket_id: {
      type: 'integer',
      notNull: true,
      references: 'support_tickets',
      onDelete: 'CASCADE',
    },
    sender_role: {
      type: 'varchar(10)',
      notNull: true,
    },
    sender_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    sender_email: {
      type: 'varchar(255)',
      notNull: true,
    },
    body: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('ticket_messages', 'ticket_id');
};

/** @type {import("node-pg-migrate").MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('ticket_messages');
  pgm.dropTable('support_tickets');
};
