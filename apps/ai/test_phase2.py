import os
import unittest


if __name__ == '__main__':
    tests_dir = os.path.join(os.path.dirname(__file__), 'tests')
    suite = unittest.defaultTestLoader.discover(tests_dir)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)
