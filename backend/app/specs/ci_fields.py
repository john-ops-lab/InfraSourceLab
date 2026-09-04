"""内置 CI 属性合同。

生成器与数据质量规则共享这份字段清单，避免用户指定不存在或类型不匹配的
字段后，系统仍然声称缺陷注入成功。
"""

CI_ATTRIBUTE_KINDS: dict[str, dict[str, str]] = {
    "data_center": {
        "location": "string",
        "country": "string",
        "status": "string",
        "environment": "string",
        "owner": "string",
    },
    "rack": {
        "u_height": "integer",
        "status": "string",
        "environment": "string",
    },
    "physical_server": {
        "hostname": "string",
        "serial_number": "string",
        "vendor": "string",
        "model": "string",
        "cpu_cores": "integer",
        "memory_gib": "integer",
        "management_ip": "string",
        "os_name": "string",
        "os_version": "string",
        "status": "string",
        "environment": "string",
    },
    "virtual_machine": {
        "hostname": "string",
        "uuid": "string",
        "cpu_cores": "integer",
        "memory_gib": "integer",
        "ip_address": "string",
        "power_state": "string",
        "os_name": "string",
        "status": "string",
        "environment": "string",
    },
    "network_device": {
        "hostname": "string",
        "serial_number": "string",
        "vendor": "string",
        "model": "string",
        "device_role": "string",
        "management_ip": "string",
        "software_version": "string",
        "status": "string",
        "environment": "string",
    },
    "ip_address": {
        "address": "string",
        "prefix_length": "integer",
        "status": "string",
        "environment": "string",
    },
    "application": {
        "code": "string",
        "owner": "string",
        "environment": "string",
        "criticality": "string",
        "lifecycle_status": "string",
    },
    "database": {
        "engine": "string",
        "version": "string",
        "host": "string",
        "port": "integer",
        "environment": "string",
        "status": "string",
    },
    "middleware": {
        "type": "string",
        "version": "string",
        "host": "string",
        "port": "integer",
        "environment": "string",
        "status": "string",
    },
    "kubernetes_cluster": {
        "version": "string",
        "environment": "string",
        "status": "string",
        "cni": "string",
    },
    "kubernetes_node": {
        "role": "string",
        "version": "string",
        "status": "string",
    },
    "kubernetes_workload": {
        "kind": "string",
        "namespace": "string",
        "replicas": "integer",
        "image": "string",
        "status": "string",
    },
}
