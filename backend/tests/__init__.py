import os
# Force all test suites to use an isolated test database
os.environ["CIPHERTRACE_DB_PATH"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "ciphertrace_test.db"))
