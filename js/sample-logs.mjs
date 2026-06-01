export const BUILT_IN_SAMPLE_LOGS = [
  {
    id: "spring-boot",
    label: "Java / Spring Boot",
    framework: "Spring Boot + Logback",
    filename: "spring-boot-checkout.log",
    content: `2026-05-30T09:00:00.112Z  INFO 18452 --- [main] c.acme.checkout.CheckoutApplication : Starting CheckoutApplication using Java 21.0.3
2026-05-30T09:00:01.480Z DEBUG 18452 --- [main] c.acme.checkout.config.ProfileLoader : Active profiles: prod,us-east
2026-05-30T09:00:03.221Z  INFO 18452 --- [main] o.s.b.w.embedded.tomcat.TomcatWebServer : Tomcat initialized with port 8080 (http)
2026-05-30T09:00:04.006Z  INFO 18452 --- [main] com.zaxxer.hikari.HikariDataSource : HikariPool-1 - Starting...
2026-05-30T09:00:04.871Z  WARN 18452 --- [main] com.zaxxer.hikari.pool.PoolBase : HikariPool-1 - Failed to validate connection org.postgresql.jdbc.PgConnection@710a4d1
2026-05-30T09:00:05.194Z  INFO 18452 --- [main] com.zaxxer.hikari.HikariDataSource : HikariPool-1 - Start completed.
2026-05-30T09:01:11.330Z  INFO 18452 --- [http-nio-8080-exec-1] c.acme.checkout.web.CartController : GET /api/cart/841 status=200 duration=31ms traceId=java-a1 spanId=web-1
2026-05-30T09:01:15.883Z  WARN 18452 --- [http-nio-8080-exec-2] c.acme.checkout.service.InventoryClient : Slow inventory lookup sku=SKU-778 duration=1520ms traceId=java-a2
2026-05-30T09:01:18.044Z ERROR 18452 --- [http-nio-8080-exec-2] c.acme.checkout.service.OrderService : Checkout failed orderId=99118 traceId=java-a2 requestId=req-99118
java.lang.IllegalStateException: Unable to reserve inventory for order 99118
	at com.acme.checkout.service.OrderService.reserve(OrderService.java:214)
	at com.acme.checkout.service.OrderService.checkout(OrderService.java:146)
	at com.acme.checkout.web.CheckoutController.create(CheckoutController.java:58)
Caused by: org.springframework.dao.QueryTimeoutException: PreparedStatementCallback; SQL [select quantity from inventory where sku=? for update]
	at org.springframework.jdbc.support.SQLExceptionSubclassTranslator.doTranslate(SQLExceptionSubclassTranslator.java:76)
Caused by: java.sql.SQLTimeoutException: canceling statement due to user request
	at org.postgresql.core.v3.QueryExecutorImpl.receiveErrorResponse(QueryExecutorImpl.java:2713)
2026-05-30T09:01:19.307Z  INFO 18452 --- [http-nio-8080-exec-3] c.acme.checkout.web.CartController : POST /api/cart/842/items status=201 duration=42ms traceId=java-a3
2026-05-30T09:02:07.419Z ERROR 18452 --- [async-payment-4] c.acme.checkout.payment.PaymentPublisher : Failed to publish payment event orderId=99118 traceId=java-a2
org.springframework.amqp.AmqpConnectException: java.net.ConnectException: Connection refused
	at org.springframework.amqp.rabbit.support.RabbitExceptionTranslator.convertRabbitAccessException(RabbitExceptionTranslator.java:61)
Caused by: java.net.ConnectException: Connection refused
	at java.base/sun.nio.ch.Net.pollConnect(Native Method)
2026-05-30T09:02:16.990Z  WARN 18452 --- [scheduling-1] c.acme.checkout.jobs.AbandonedCartJob : Job abandoned-cart-scan exceeded threshold duration=2431ms
2026-05-30T09:03:03.551Z  INFO 18452 --- [http-nio-8080-exec-5] c.acme.checkout.web.HealthController : GET /actuator/health status=200 duration=8ms
2026-05-30T09:03:48.201Z ERROR 18452 --- [http-nio-8080-exec-6] c.acme.checkout.web.CheckoutController : NullPointerException while applying coupon code=SPRING traceId=java-a4
2026-05-30T09:04:02.771Z  INFO 18452 --- [scheduling-1] c.acme.checkout.jobs.MetricsFlushJob : Flushed 128 metrics to collector
2026-05-30T09:04:35.118Z FATAL 18452 --- [main] c.acme.checkout.CheckoutApplication : Application failed because database migrations did not complete
2026-05-30T09:04:36.000Z  INFO 18452 --- [SpringApplicationShutdownHook] c.zaxxer.hikari.HikariDataSource : HikariPool-1 - Shutdown initiated`
  },
  {
    id: "fastapi",
    label: "Python / FastAPI",
    framework: "FastAPI + Uvicorn",
    filename: "fastapi-orders.log",
    content: `2026-05-30 10:00:00 INFO uvicorn.error Started server process [42177]
2026-05-30 10:00:00 INFO uvicorn.error Waiting for application startup.
2026-05-30 10:00:01 DEBUG app.config loaded settings env=prod region=us-east-1
2026-05-30 10:00:01 INFO uvicorn.error Application startup complete.
2026-05-30 10:00:04 INFO uvicorn.access 10.10.4.12:51820 - "GET /health HTTP/1.1" 200 traceId=py-a1
2026-05-30 10:01:11 INFO app.api.orders request_id=req-py-1001 user_id=219 route=/orders
2026-05-30 10:01:12 WARNING app.clients.redis Redis latency high duration_ms=488 host=redis-01
2026-05-30 10:01:18 ERROR app.api.orders Failed to create order requestId=req-py-1001 traceId=py-a2
Traceback (most recent call last):
  File "/srv/app/api/orders.py", line 88, in create_order
    order = await service.create(payload)
  File "/srv/app/services/orders.py", line 141, in create
    await self.inventory.reserve(payload.items)
  File "/srv/app/clients/inventory.py", line 52, in reserve
    raise TimeoutError("inventory service timed out after 2000ms")
TimeoutError: inventory service timed out after 2000ms
2026-05-30 10:01:20 INFO uvicorn.access 10.10.4.12:51820 - "POST /orders HTTP/1.1" 500 traceId=py-a2
2026-05-30 10:02:06 INFO app.jobs.reconcile reconcile_batch_started batch=20260530-1002
2026-05-30 10:02:11 WARNING app.jobs.reconcile missing invoice invoice_id=INV-8841 customer_id=771
2026-05-30 10:02:17 ERROR app.jobs.reconcile Could not write reconciliation result traceId=py-job-7
Traceback (most recent call last):
  File "/srv/app/jobs/reconcile.py", line 67, in run
    writer.write(summary)
  File "/srv/app/storage/postgres.py", line 31, in write
    raise psycopg.errors.SerializationFailure("could not serialize access due to concurrent update")
psycopg.errors.SerializationFailure: could not serialize access due to concurrent update
2026-05-30 10:03:03 INFO app.api.orders request_id=req-py-1002 user_id=220 route=/orders/99118
2026-05-30 10:03:05 DEBUG app.cache cache hit key=order:99118
2026-05-30 10:04:33 CRITICAL app.worker worker crashed queue=emails correlationId=mail-batch-55
2026-05-30 10:05:01 INFO uvicorn.error Shutting down`
  },
  {
    id: "node-pino",
    label: "Node.js / Pino",
    framework: "Express + Pino",
    filename: "node-pino-checkout.jsonl",
    content: `{"level":30,"time":1772298000112,"pid":8812,"hostname":"api-01","service":"checkout-api","msg":"server listening","port":3000}
{"level":20,"time":1772298001420,"pid":8812,"hostname":"api-01","service":"checkout-api","msg":"loaded feature flags","flags":34}
{"level":30,"time":1772298025311,"pid":8812,"hostname":"api-01","service":"checkout-api","reqId":"node-1001","traceId":"node-a1","msg":"GET /health completed","statusCode":200,"duration":9}
{"level":30,"time":1772298062004,"pid":8812,"hostname":"api-01","service":"checkout-api","reqId":"node-1002","traceId":"node-a2","msg":"POST /checkout started","cartId":841}
{"level":40,"time":1772298063559,"pid":8812,"hostname":"api-01","service":"checkout-api","reqId":"node-1002","traceId":"node-a2","msg":"inventory lookup slow","duration":1320}
{"level":50,"time":1772298065102,"pid":8812,"hostname":"api-01","service":"checkout-api","reqId":"node-1002","traceId":"node-a2","err":"PrismaClientKnownRequestError","msg":"database transaction failed","code":"P2034"}
{"level":30,"time":1772298066032,"pid":8812,"hostname":"api-01","service":"checkout-api","reqId":"node-1003","traceId":"node-a3","msg":"GET /products/771 completed","statusCode":200,"duration":44}
{"level":40,"time":1772298112018,"pid":8812,"hostname":"api-01","service":"checkout-api","msg":"retrying kafka publish","topic":"payments","attempt":1}
{"level":50,"time":1772298114050,"pid":8812,"hostname":"api-01","service":"checkout-api","err":"KafkaJSNumberOfRetriesExceeded","msg":"payment event publish failed","topic":"payments","orderId":99118}
{"level":30,"time":1772298129011,"pid":8812,"hostname":"api-01","service":"checkout-api","reqId":"node-1004","traceId":"node-a4","msg":"GET /orders/99118 completed","statusCode":200,"duration":53}
{"level":20,"time":1772298150001,"pid":8812,"hostname":"api-01","service":"checkout-api","msg":"cache refresh started","segment":"catalog"}
{"level":30,"time":1772298167003,"pid":8812,"hostname":"api-01","service":"checkout-api","msg":"cache refresh completed","items":1842}
{"level":40,"time":1772298201115,"pid":8812,"hostname":"api-01","service":"checkout-api","msg":"event loop lag high","lag":284}
{"level":50,"time":1772298244028,"pid":8812,"hostname":"api-01","service":"checkout-api","err":"TypeError","msg":"Cannot read properties of undefined reading 'amount'","reqId":"node-1005"}
{"level":30,"time":1772298277007,"pid":8812,"hostname":"api-01","service":"checkout-api","msg":"scheduled settlement scan finished","count":94}
{"level":60,"time":1772298300999,"pid":8812,"hostname":"api-01","service":"checkout-api","err":"OutOfMemoryError","msg":"process heap limit exceeded","rss":927989760}
{"level":30,"time":1772298312011,"pid":8812,"hostname":"api-01","service":"checkout-api","msg":"received SIGTERM"}
{"level":30,"time":1772298316222,"pid":8812,"hostname":"api-01","service":"checkout-api","msg":"server closed"}`
  },
  {
    id: "go-zap",
    label: "Go / Zap",
    framework: "Go HTTP service + Zap",
    filename: "go-zap-inventory.log",
    content: `2026-05-30T11:00:00.041Z INFO inventory-api booting version=2.8.0 commit=9fd03ac
2026-05-30T11:00:00.319Z DEBUG inventory-api loaded config warehouse_count=4
2026-05-30T11:00:01.004Z INFO inventory-api listening addr=:9090
2026-05-30T11:00:12.291Z INFO inventory-api request method=GET path=/health status=200 duration=2ms traceId=go-a1
2026-05-30T11:01:03.510Z INFO inventory-api reserve sku=SKU-778 qty=2 warehouse=iad-1 traceId=go-a2
2026-05-30T11:01:04.118Z WARN inventory-api lock wait high sku=SKU-778 wait=704ms
2026-05-30T11:01:05.772Z ERROR inventory-api reservation failed sku=SKU-778 order=99118 traceId=go-a2 error="context deadline exceeded"
2026-05-30T11:01:06.004Z INFO inventory-api reserve sku=SKU-119 qty=1 warehouse=iad-2 traceId=go-a3
2026-05-30T11:01:06.991Z INFO inventory-api reservation committed sku=SKU-119 order=99119
2026-05-30T11:02:10.120Z WARN inventory-api db connection pool saturated open=60 idle=0 wait_count=481
2026-05-30T11:02:12.883Z ERROR inventory-api postgres query failed query=reserve_inventory error="pq: deadlock detected" correlationId=inv-batch-22
2026-05-30T11:02:22.002Z INFO inventory-api background job stock-sync started
2026-05-30T11:02:25.114Z WARN inventory-api supplier feed delayed supplier=west-coast-feed lag=95s
2026-05-30T11:03:01.408Z INFO inventory-api stock-sync updated sku_count=804
2026-05-30T11:03:41.922Z ERROR inventory-api panic recovered path=/reserve panic="runtime error: invalid memory address or nil pointer dereference"
2026-05-30T11:03:42.100Z INFO inventory-api request method=POST path=/reserve status=500 duration=2087ms traceId=go-a4
2026-05-30T11:04:18.334Z DEBUG inventory-api cache prune removed=202
2026-05-30T11:04:48.550Z FATAL inventory-api unable to open write-ahead log error="no space left on device"
2026-05-30T11:04:49.003Z INFO inventory-api shutdown started reason=fatal-error`
  },
  {
    id: "dotnet",
    label: ".NET / ASP.NET Core",
    framework: "ASP.NET Core + Serilog",
    filename: "dotnet-payments.log",
    content: `2026-05-30 12:00:00.102 +00:00 [INFO] Payments.Api starting Environment=Production
2026-05-30 12:00:00.845 +00:00 [DEBUG] Loaded configuration section=Kafka
2026-05-30 12:00:01.330 +00:00 [INFO] Now listening on: http://0.0.0.0:5000
2026-05-30 12:00:08.114 +00:00 [INFO] Request starting HTTP/1.1 GET /health TraceId=dotnet-a1
2026-05-30 12:00:08.132 +00:00 [INFO] Request finished HTTP/1.1 GET /health 200 18.4ms
2026-05-30 12:01:02.901 +00:00 [INFO] Request starting HTTP/1.1 POST /payments TraceId=dotnet-a2 RequestId=req-dot-702
2026-05-30 12:01:03.144 +00:00 [WARN] Acquirer latency above threshold Provider=NorthBank DurationMs=1844
2026-05-30 12:01:04.020 +00:00 [ERROR] Payment authorization failed PaymentId=pay_99118 TraceId=dotnet-a2
System.TimeoutException: The operation has timed out.
   at Payments.Infrastructure.AcquirerClient.AuthorizeAsync(Payment payment) in /src/AcquirerClient.cs:line 77
   at Payments.Application.PaymentService.AuthorizeAsync(Payment payment) in /src/PaymentService.cs:line 118
2026-05-30 12:01:04.221 +00:00 [INFO] Request finished HTTP/1.1 POST /payments 502 1320.9ms
2026-05-30 12:02:10.004 +00:00 [INFO] Settlement batch started BatchId=settle-20260530-1202
2026-05-30 12:02:12.901 +00:00 [WARN] Duplicate webhook ignored EventId=evt_778
2026-05-30 12:02:18.443 +00:00 [ERROR] Failed executing DbCommand (30,001ms) [Parameters=[@p0='pay_99118'], CommandType='Text']
Microsoft.Data.SqlClient.SqlException (0x80131904): Timeout expired. The timeout period elapsed prior to completion of the operation.
   at Microsoft.Data.SqlClient.SqlCommand.ExecuteReaderAsync()
2026-05-30 12:03:00.554 +00:00 [INFO] Request starting HTTP/1.1 GET /payments/pay_99118 TraceId=dotnet-a3
2026-05-30 12:03:00.718 +00:00 [INFO] Request finished HTTP/1.1 GET /payments/pay_99118 200 164.2ms
2026-05-30 12:04:27.615 +00:00 [FATAL] Host terminated unexpectedly due to unhandled exception OutOfMemoryException
2026-05-30 12:04:28.001 +00:00 [INFO] Application is shutting down...`
  },
  {
    id: "android-logcat",
    label: "Android / Logcat",
    framework: "Android logcat",
    filename: "android-logcat-shopping.log",
    content: `05-30 13:00:00.102 1421 1421 I ShoppingApp: process started version=7.4.2
05-30 13:00:00.344 1421 1450 D OkHttp: --> GET https://api.example.test/health
05-30 13:00:00.499 1421 1450 I OkHttp: <-- 200 https://api.example.test/health (155ms)
05-30 13:01:11.013 1421 1421 I ActivityTaskManager: Displayed com.acme.shopping/.MainActivity: +1s244ms
05-30 13:01:14.771 1421 1488 W ShoppingCartService: cart sync slow duration=1460ms traceId=and-a1
05-30 13:01:16.224 1421 1488 E ShoppingCartService: checkout failed cartId=841 traceId=and-a1 requestId=req-and-841
05-30 13:01:16.225 1421 1488 E ShoppingCartService: java.net.SocketTimeoutException: timeout
05-30 13:01:16.226 1421 1488 E ShoppingCartService:     at okhttp3.internal.connection.RealCall.timeoutExit(RealCall.kt:398)
05-30 13:01:16.227 1421 1488 E ShoppingCartService:     at com.acme.shopping.api.CheckoutApi.submit(CheckoutApi.kt:91)
05-30 13:01:20.503 1421 1450 I OkHttp: <-- 500 https://api.example.test/checkout (4280ms)
05-30 13:02:02.018 1421 1499 D Room: BEGIN TRANSACTION
05-30 13:02:02.199 1421 1499 W SQLiteLog: (5) database is locked
05-30 13:02:03.004 1421 1499 E CartRepository: failed to persist cart item sku=SKU-778
05-30 13:02:03.005 1421 1499 E CartRepository: android.database.sqlite.SQLiteDatabaseLockedException: database is locked
05-30 13:03:10.017 1421 1421 I ActivityTaskManager: START u0 {act=android.intent.action.VIEW dat=shopping://orders/99118}
05-30 13:03:14.229 1421 1510 W ImageLoader: decode took 612ms url=https://cdn.example.test/products/778.png
05-30 13:04:22.551 1421 1421 F AndroidRuntime: FATAL EXCEPTION: main
05-30 13:04:22.552 1421 1421 F AndroidRuntime: Process: com.acme.shopping, PID: 1421
05-30 13:04:22.553 1421 1421 F AndroidRuntime: java.lang.OutOfMemoryError: Failed to allocate a 16777216 byte allocation
05-30 13:04:22.554 1421 1421 F AndroidRuntime:     at android.graphics.BitmapFactory.nativeDecodeStream(Native Method)
05-30 13:04:23.101 1421 1421 I Process: Sending signal. PID: 1421 SIG: 9`
  },
];

export function combinedSampleLog() {
  return {
    label: "全部内置示例",
    fileCount: BUILT_IN_SAMPLE_LOGS.length,
    content: BUILT_IN_SAMPLE_LOGS
      .map((sample) => `# ${sample.label} (${sample.framework})\n${sample.content}`)
      .join("\n\n"),
  };
}

export function findSampleLog(id) {
  return BUILT_IN_SAMPLE_LOGS.find((sample) => sample.id === id) || null;
}
