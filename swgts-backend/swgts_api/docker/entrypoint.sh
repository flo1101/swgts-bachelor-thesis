#!/bin/sh

#Give non-root write access to the output folder (create uploads folder, write fastq)
chown www-data:www-data ./output
chmod u+rwX ./output
exec python -m swgts_api