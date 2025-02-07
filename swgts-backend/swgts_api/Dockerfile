# We build the backend first, then the frontend, and then install everything in a new container.

ARG PYTHON_IMAGE_TAG=3.12-slim

# Backend
FROM python:$PYTHON_IMAGE_TAG AS backend-builder

# We need to build minimap2's mappy from source, because the PyPI distribution is somehow broken.
# Therefore we need those dependencies. We then build wheels for everything so we can easily install
# it into a clean Dockerimage.
RUN apt-get update && \
    apt-get --no-install-recommends --yes install git gcc libc-dev zlib1g-dev

ADD swgts-backend/swgts_api backend
RUN mkdir /dummy_git
ADD .git /dummy_git/.git
# This could also be moved to the requirements.txt
RUN pip wheel --no-cache-dir --wheel-dir wheels \
        ./backend

# We now have all built, so we can put everything together
FROM python:$PYTHON_IMAGE_TAG

# Copy artifacts from backend stage
COPY --from=backend-builder wheels wheels
COPY swgts-backend/swgts_api/requirements.txt .


# Install our application, and its dependencies
RUN pip install -r requirements.txt
RUN pip install wheels/*.whl && \
    rm -rf wheels

# Create important directories
RUN mkdir -p /output /input /var/www/swgts

# Ensure the rights are correctly set
RUN chown -R root:root /var/www/swgts /output
RUN chmod -R u+w /var/www/swgts /output

#add entrypoint
ADD swgts-backend/swgts_api/docker/entrypoint.sh /entrypoint.sh

EXPOSE 80
CMD ["/bin/sh","/entrypoint.sh"]
